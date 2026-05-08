// src/lib/quoteActions.js
//
// All quote state transitions live here. Each function:
//   1. Re-checks permission (UI hides buttons, RLS enforces, this is middle layer)
//   2. Writes status + timestamp/actor columns in one update
//   3. Writes an audit_log row
//   4. Fires Phase D notifications (email + in-app) — best effort, never blocks
//
// All functions return { data, error } to match the supabase pattern.

import { supabase } from './supabase';
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
  resolveEmails,
  readSecret,
} from './notify';
import {
  quoteApprovalNeeded,
  quoteApproved,
} from './email_templates';

// --- internal -----------------------------------------------------------

async function logEvent(quoteId, event, actorId, meta = null) {
  const { error } = await supabase.from('audit_log').insert({
    quote_id: quoteId,
    event,
    actor_id: actorId,
    meta,
  });
  if (error) console.error('audit_log insert failed:', event, error);
}

// Try to read the configured app base URL; fall back to current origin.
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

  await logEvent(
    quote.id,
    isSelf ? 'quote_self_approved' : 'quote_approved',
    profile.id,
  );

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
      // fire-and-forget
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

/**
 * Wrap your existing NewQuote insert with this. Pass the row you'd otherwise
 * insert; we'll set status correctly and add timestamps if auto-approving.
 */
export function buildNewQuoteRow(rawRow, profile) {
  const now = new Date().toISOString();
  const base = {
    ...rawRow,
    salesperson_id: rawRow.salesperson_id || profile.id, // Phase 5 fix
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

/**
 * Call AFTER the insert succeeds. Writes the audit event AND fires
 * the "needs approval" email to sales admins + managers (only if not auto-approved).
 */
export async function logNewQuoteEvent({ quoteId, autoApproved, profile, quote }) {
  if (autoApproved) {
    await logEvent(quoteId, 'quote_self_approved', profile.id, {
      reason: 'sales_admin_auto_approve_on_create',
    });
    return; // nobody else needs to know — sales admin approved their own
  }

  await logEvent(quoteId, 'quote_submitted_for_approval', profile.id);

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
    .filter((id) => id !== profile.id) // don't ping yourself if you somehow qualify
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

  await logEvent(quote.id, 'quote_marked_delivered', profile.id);
  // No notification: it's a self-action celebration, not actionable for others.

  return { data, error: null };
}

// --- mark lost (7-day window, NO immediate archive) --------------------

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

  await logEvent(quote.id, 'quote_marked_lost', profile.id, reason ? { reason } : null);
  // No notification — pg_cron sweeps to archive after 7 days, no email needed.

  return { data, error: null };
}

// --- manual archive (manager-only escape hatch) ------------------------

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
  await logEvent(quote.id, 'quote_archived_manual', profile.id, { reason });
  return { data, error: null };
}

// --- unarchive (oops button) -------------------------------------------

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
  await logEvent(quote.id, 'quote_unarchived', profile.id, { restored_to: restored });
  return { data, error: null };
}

// --- generic save w/ last_edited tracking -------------------------------

export async function saveQuoteEdits({ quoteId, patch, profile }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...patch, last_edited_at: now, last_edited_by: profile.id })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) return { data: null, error };
  await logEvent(quoteId, 'quote_edited', profile.id);
  return { data, error: null };
}
