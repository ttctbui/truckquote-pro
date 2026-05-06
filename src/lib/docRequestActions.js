// src/lib/docRequestActions.js
//
// Doc request status transitions:
//   pending     ←→ incomplete (Joe sets incomplete; salesperson OR Joe flips back)
//   pending     →  ready (Joe; terminal)

import { supabase } from './supabase';
import {
  canMarkDocIncomplete,
  canMarkDocReady,
  canReopenDocAsJoe,
  canRequestDocUpdate,
} from './permissions';

async function logDocEvent(docId, quoteId, event, actorId, meta = null) {
  const { error } = await supabase.from('audit_log').insert({
    quote_id: quoteId,        // pivot on quote for the activity feed
    doc_request_id: docId,    // assumes audit_log has this nullable column;
                              // if not yet added, drop this line — meta below carries it
    event,
    actor_id: actorId,
    meta: { ...(meta || {}), doc_request_id: docId },
  });
  if (error) console.error('audit_log insert failed:', event, error);
}

// --- Joe: pending → incomplete -----------------------------------------

export async function markDocIncomplete({ doc, profile, reason }) {
  if (!canMarkDocIncomplete(profile, doc)) {
    return { data: null, error: new Error('Not authorized.') };
  }
  if (!reason || !reason.trim()) {
    return { data: null, error: new Error('A reason is required when marking incomplete.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('doc_requests')
    .update({
      status: 'incomplete',
      incomplete_at: now,
      incomplete_by: profile.id,
      incomplete_reason: reason.trim(),
    })
    .eq('id', doc.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logDocEvent(doc.id, doc.quote_id, 'doc_request_marked_incomplete', profile.id, { reason });
  // TODO: Phase D — email salesperson "Joe needs more info: <reason>"
  return { data, error: null };
}

// --- Joe: pending → ready (terminal) -----------------------------------

export async function markDocReady({ doc, profile }) {
  if (!canMarkDocReady(profile, doc)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('doc_requests')
    .update({
      status: 'ready',
      ready_at: now,
      ready_by: profile.id,
    })
    .eq('id', doc.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logDocEvent(doc.id, doc.quote_id, 'doc_request_marked_ready', profile.id);
  // TODO: Phase D — email salesperson "your docs are ready"
  return { data, error: null };
}

// --- Salesperson: Request Update (incomplete → pending) ---------------

export async function requestDocUpdate({ doc, quote, profile }) {
  if (!canRequestDocUpdate(profile, doc, quote)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('doc_requests')
    .update({
      status: 'pending',
      pending_at: now,
      last_update_requested_at: now,
      last_update_requested_by: profile.id,
      update_request_count: (doc.update_request_count || 0) + 1,
    })
    .eq('id', doc.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logDocEvent(doc.id, doc.quote_id, 'doc_request_update_requested', profile.id);
  // TODO: Phase D — email Joe "salesperson responded, please re-review"
  return { data, error: null };
}

// --- Joe: manual reopen (incomplete → pending) ------------------------

export async function reopenDocAsJoe({ doc, profile }) {
  if (!canReopenDocAsJoe(profile, doc)) {
    return { data: null, error: new Error('Not authorized.') };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('doc_requests')
    .update({
      status: 'pending',
      pending_at: now,
      // intentionally NOT bumping update_request_count — Joe's override isn't
      // a salesperson request
    })
    .eq('id', doc.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logDocEvent(doc.id, doc.quote_id, 'doc_request_reopened_by_joe', profile.id);
  return { data, error: null };
}
