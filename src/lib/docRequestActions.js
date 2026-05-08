// src/lib/docRequestActions.js
//
// Doc request status transitions:
//   pending     ←→ incomplete (Joe sets incomplete; salesperson OR Joe flips back)
//   pending     →  ready (Joe; terminal)
//
// Phase D: emails Joe when a NEW doc request is submitted.
// Other doc-request events (incomplete, update_requested, ready) are wired
// in drop 3.

import { supabase } from './supabase';
import {
  canMarkDocIncomplete,
  canMarkDocReady,
  canReopenDocAsJoe,
  canRequestDocUpdate,
} from './permissions';
import { sendNotification, readSecret } from './notify';
import { docRequestNew } from './email_templates';

async function logDocEvent(docId, quoteId, event, actorId, meta = null) {
  const { error } = await supabase.from('audit_log').insert({
    quote_id: quoteId,
    event,
    actor_id: actorId,
    meta: { ...(meta || {}), doc_request_id: docId },
  });
  if (error) console.error('audit_log insert failed:', event, error);
}

async function getBaseUrl() {
  const fromSecret = await readSecret('app_base_url');
  if (fromSecret) return fromSecret.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://truckquote-pro.vercel.app';
}

/**
 * Phase D — call this AFTER the doc_request row has been inserted.
 * Reads the configured Joe-recipients from tqp_secrets so admins can
 * change who gets these emails without code deploys.
 */
export async function notifyDocRequestSubmitted({ doc, quote, profile }) {
  // Recipients: editable in tqp_secrets (so when Joe is on PTO, IT can swap)
  const csv = await readSecret('doc_request_recipients');
  const emails = (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));

  if (!emails.length) {
    console.warn('No doc_request_recipients configured in tqp_secrets — email skipped.');
    return;
  }

  const baseUrl = await getBaseUrl();
  const { subject, html } = docRequestNew({
    quote,
    doc,
    salespersonName: profile?.full_name || profile?.email,
    baseUrl,
  });

  // Look up f_and_i users for in-app notifications too
  const { data: fAndIUsers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'f_and_i');

  const notifications = (fAndIUsers || []).map((u) => ({
    user_id: u.id,
    kind: 'doc_request_new',
    title: `New doc request: ${quote.customer_name || 'Customer'}`,
    body: `From ${profile?.full_name || profile?.email || 'a salesperson'} · Deal ${doc.deal_number || quote.deal_number || '?'}`,
    link: `/quotes/${quote.id}`,
    quote_id: quote.id,
  }));

  sendNotification({
    template: 'doc_request_new',
    to: emails,
    subject,
    html,
    notifications,
    quote_id: quote.id,
    payload: { submitter_id: profile?.id, deal_number: doc.deal_number },
  });
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
  // TODO: Phase D drop 3 — email salesperson "Joe needs more info: <reason>"
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
  // TODO: Phase D drop 3 — email salesperson "your docs are ready"
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
  // TODO: Phase D drop 3 — email Joe "salesperson responded, please re-review"
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
    })
    .eq('id', doc.id)
    .select()
    .single();

  if (error) return { data: null, error };

  await logDocEvent(doc.id, doc.quote_id, 'doc_request_reopened_by_joe', profile.id);
  return { data, error: null };
}
