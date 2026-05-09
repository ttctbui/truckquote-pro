// src/lib/notify.js
//
// Frontend helper for sending notifications.
// Calls the `send-email` Edge Function. Never sees the Resend API key.
//
// Usage:
//   import { sendNotification } from './notify';
//   await sendNotification({
//     template: 'quote_approval_needed',
//     to: ['someone@ttruck.com'],
//     subject: 'New quote needs approval',
//     html: '<p>...</p>',
//     notifications: [{ user_id, kind, title, body, link }],
//     quote_id,
//   });
//
// Failures are LOGGED but NOT thrown — a failed email should never block
// a user action. Email is best-effort; the audit_log is the source of truth.

import { supabase } from './supabase';

/**
 * Look up email addresses for a set of profile/auth IDs.
 * Returns array of strings (emails). Skips IDs that resolve to nothing.
 */
export async function resolveEmails(userIds) {
  if (!userIds || !userIds.length) return [];
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', ids);

  if (error) {
    console.warn('resolveEmails error:', error);
    return [];
  }
  return (data ?? []).map((r) => r.email).filter(Boolean);
}

/**
 * Look up email addresses for all users in given roles.
 * e.g. emailsForRoles(['sales_admin','manager','admin'])
 */
export async function emailsForRoles(roles) {
  if (!roles?.length) return { emails: [], userIds: [] };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .in('role', roles);

  if (error) {
    console.warn('emailsForRoles error:', error);
    return { emails: [], userIds: [] };
  }
  const rows = (data ?? []).filter((r) => r.email);
  return {
    emails: rows.map((r) => r.email),
    userIds: rows.map((r) => r.id),
  };
}

/**
 * Read a config value from tqp_secrets. Used for things like the Joe
 * recipient list which the admin can update without redeploying code.
 *
 * NOTE: tqp_secrets has admin-only RLS. For non-admin callers this
 * returns null silently. The Edge Function reads secrets server-side
 * with the service role for actual sending.
 */
export async function readSecret(key) {
  const { data, error } = await supabase
    .from('tqp_secrets')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return data.value;
}

/**
 * Core send. Calls the Edge Function. Always returns an object —
 * never throws — so callers can `await` without try/catch.
 */
export async function sendNotification({
  template,
  to,
  subject,
  html,
  notifications,
  quote_id,
  payload,
}) {
  if (!template || !to?.length || !subject || !html) {
    console.warn('sendNotification missing required field', { template, to, subject });
    return { ok: false, error: 'missing_field' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        template,
        to,
        subject,
        html,
        notifications,
        quote_id,
        payload,
      },
    });

    if (error) {
      console.warn(`sendNotification[${template}] failed:`, error);
      return { ok: false, error: error.message || String(error) };
    }
    return data ?? { ok: true };
  } catch (e) {
    console.warn(`sendNotification[${template}] threw:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Convenience: write an in-app notification only (no email).
 * Used for things where email would be noise but the bell icon should ping.
 */
export async function notifyInApp({ user_id, kind, title, body, link, quote_id }) {
  if (!user_id || !kind || !title) {
    console.warn('notifyInApp missing required field');
    return { ok: false };
  }
  const { error } = await supabase.from('tqp_notifications').insert({
    user_id, kind, title, body, link, quote_id,
  });
  if (error) {
    console.warn('notifyInApp insert failed:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
