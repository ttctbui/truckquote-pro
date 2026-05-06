// src/lib/quoteActions.js
//
// All quote state transitions live here. Each function:
//   1. Re-checks permission (defense in depth — UI hides buttons, RLS enforces, this is the middle layer)
//   2. Writes the status + timestamp/actor columns in one update
//   3. Writes an audit_log row
//   4. Leaves a Phase D notification hook
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

  // TODO: Phase D notification — email salesperson "your quote is approved"
  // (skip if isSelf, they already know)

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
 * Call AFTER the insert succeeds, to write the audit event.
 */
export async function logNewQuoteEvent({ quoteId, autoApproved, profile }) {
  if (autoApproved) {
    await logEvent(quoteId, 'quote_self_approved', profile.id, {
      reason: 'sales_admin_auto_approve_on_create',
    });
  }
  // Non-auto path: the regular "quote_created" event from your existing trigger handles it.
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
  // TODO: Phase D — celebrate notification to manager / sales_admin

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
  // pg_cron sweeps to archive after 7 days. No notification on Lost.

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
      // If we're un-Losting, clear the lost_at so the cron doesn't immediately re-archive
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
