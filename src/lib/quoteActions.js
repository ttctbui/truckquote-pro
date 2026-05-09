// src/lib/quoteActions.js
//
// All quote state transitions live here. Each function:
//   1. Re-checks permission (UI hides buttons, RLS enforces, this is middle layer)
//   2. Writes status + timestamp/actor columns in one update
//   3. Writes an audit_log entry via the existing logAuditEvent helper
//   4. Fires Phase D notifications (email + in-app) — best effort, never blocks

import { supabase } from './supabase';
import { logAuditEvent } from './audit';
import {
  canApprove,
  canMarkDelivered,
  canMarkLost,
  canArchiveManual,
  canUnarchive,
  shouldAutoApprove,
} from './permissions';
import {
  sendNotification,
  emailsForRoles,
  readSecret,
} from './notify';
import {
  quoteApprovalNeeded,
  quoteApproved,
} from './email_templates';

// --- internal helpers ---------------------------------------------------

async function getBaseUrl() {
  const fromSecret = await readSecret('app_base_url');
  if (fromSecret) return fromSecret.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://truckquote-pro.vercel.app';
}

async function lookupProfile(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', userId)
    .maybeSingle();
  return data || null;
}

// --- approve ------------------------------------------------------------

export async function approveQuote({ quote, profile }) {
  if (!canApprove(profile, quote)) {
    return { data: null, error: new Error('Not authorized to approve this quote.') };
  }

  const isSelf = quote.salesperson_id === profile.id;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('quotes')
    .update({
      status: 'approved',
      approved_at: now,
      approved_by: profile.id,
      last_edited_at: now,
      last_edited_by: profile.id,
    })
    .eq('id', quote.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quote.id,
    action: isSelf ? 'quote_self_approved' : 'quote_approved',
    context: { quote_number: data.quote_number, customer: data.customer_name },
  });

  // 📨 Phase D: notify the salesperson — but skip if they approved their own quote
  if (!isSelf && data?.salesperson_id) {
    const baseUrl = await getBaseUrl();
    const salespersonProfile = await lookupProfile(data.salesperson_id);
    const salespersonEmail = salespersonProfile?.email;
    if (salespersonEmail) {
      const { subject, html } = quoteApproved({
        quote: data,
        approverName: profile.full_name || profile.email,
        baseUrl,
      });
      sendNotification({
        template: 'quote_approved',
        to: [salespersonEmail],
        subject,
        html,
        notifications: [{
          user_id: data.salesperson_id,
          kind: 'quote_approved',
          title: `Quote approved: ${data.quote_number || ''}`,
          body: `Approved by ${profile.full_name || profile.email}`,
          link: `/quotes/${data.id}`,
          quote_id: data.id,
        }],
        quote_id: data.id,
        payload: { approver_id: profile.id, quote_number: data.quote_number },
      });
    }
  }

  return { data, error: null };
}

// --- create with auto-approve check ------------------------------------

export function buildNewQuoteRow(rawRow, profile) {
  const now = new Date().toISOString();
  const base = {
    ...rawRow,
    salesperson_id: rawRow.salesperson_id || profile.id,
    last_edited_at: now,
    last_edited_by: profile.id,
  };

  if (shouldAutoApprove(profile)) {
    return {
      row: {
        ...base,
        status: 'approved',
        approved_at: now,
        approved_by: profile.id,
      },
      autoApproved: true,
    };
  }

  return {
    row: { ...base, status: 'pending_approval' },
    autoApproved: false,
  };
}

export async function logNewQuoteEvent({ quoteId, autoApproved, profile, quote }) {
  if (autoApproved) {
    await logAuditEvent({
      tableName: 'quotes',
      recordId: quoteId,
      action: 'quote_self_approved',
      context: { reason: 'sales_admin_auto_approve_on_create' },
    });
    return; // sales admin approved their own — nobody else needs to know
  }

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quoteId,
    action: 'quote_submitted_for_approval',
    context: { submitter_id: profile.id },
  });

  // 📨 Phase D: tell sales admins + managers + admins to come look
  const baseUrl = await getBaseUrl();
  const { emails, userIds } = await emailsForRoles(['sales_admin', 'manager', 'admin']);
  if (!emails.length) return;

  const fullQuote = quote ?? (await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()
    .then(({ data }) => data));

  if (!fullQuote) return;

  const { subject, html } = quoteApprovalNeeded({
    quote: fullQuote,
    salespersonName: profile.full_name || profile.email,
    baseUrl,
  });

  const notifications = userIds
    .filter((id) => id !== profile.id)
    .map((id) => ({
      user_id: id,
      kind: 'quote_approval_needed',
      title: `Quote needs approval: ${fullQuote.quote_number || ''}`,
      body: `${profile.full_name || profile.email} submitted ${fullQuote.customer_name || 'a quote'}`,
      link: `/quotes/${fullQuote.id}`,
      quote_id: fullQuote.id,
    }));

  sendNotification({
    template: 'quote_approval_needed',
    to: emails,
    subject,
    html,
    notifications,
    quote_id: fullQuote.id,
    payload: {
      submitter_id: profile.id,
      quote_number: fullQuote.quote_number,
    },
  });
}

// --- mark delivered (auto-archive) -------------------------------------

export async function markDelivered({ quote, profile }) {
  if (!canMarkDelivered(profile, quote)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({
      status: 'delivered',
      delivered_at: now,
      delivered_by: profile.id,
      archived_at: now,
      archived_by: profile.id,
      archive_reason: 'delivered',
      pre_archive_status: 'delivered',
      last_edited_at: now,
      last_edited_by: profile.id,
    })
    .eq('id', quote.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quote.id,
    action: 'quote_marked_delivered',
    context: { quote_number: data.quote_number },
  });

  return { data, error: null };
}

// --- mark lost ---------------------------------------------------------

export async function markLost({ quote, profile, reason = null }) {
  if (!canMarkLost(profile, quote)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({
      status: 'lost',
      lost_at: now,
      lost_by: profile.id,
      last_edited_at: now,
      last_edited_by: profile.id,
    })
    .eq('id', quote.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quote.id,
    action: 'quote_marked_lost',
    context: { quote_number: data.quote_number, reason },
  });

  return { data, error: null };
}

// --- manual archive ---------------------------------------------------

export async function archiveManual({ quote, profile, reason }) {
  if (!canArchiveManual(profile, quote)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({
      archived_at: now,
      archived_by: profile.id,
      archive_reason: reason || 'manual',
      pre_archive_status: quote.status,
    })
    .eq('id', quote.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quote.id,
    action: 'quote_archived_manual',
    context: { reason, quote_number: data.quote_number },
  });

  return { data, error: null };
}

// --- unarchive ---------------------------------------------------------

export async function unarchive({ quote, profile }) {
  if (!canUnarchive(profile, quote)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const restored = quote.pre_archive_status || 'pending_approval';
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('quotes')
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      pre_archive_status: null,
      status: restored,
      lost_at: restored === 'lost' ? null : quote.lost_at,
      lost_by: restored === 'lost' ? null : quote.lost_by,
      last_edited_at: now,
      last_edited_by: profile.id,
    })
    .eq('id', quote.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quote.id,
    action: 'quote_unarchived',
    context: { restored_to: restored, quote_number: data.quote_number },
  });

  return { data, error: null };
}

// --- generic save w/ last_edited tracking ------------------------------

export async function saveQuoteEdits({ quoteId, patch, profile }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...patch, last_edited_at: now, last_edited_by: profile.id })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) return { data: null, error };

  await logAuditEvent({
    tableName: 'quotes',
    recordId: quoteId,
    action: 'quote_edited',
    context: { fields_changed: Object.keys(patch) },
  });

  return { data, error: null };
}
