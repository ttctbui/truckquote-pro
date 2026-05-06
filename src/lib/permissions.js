// src/lib/permissions.js
//
// Single source of truth for "can this user do X to this row?"
// Both UI (button visibility) and action handlers (final guard) use these.
// RLS in Supabase is the *real* enforcement — these are the friendly layer.

const APPROVER_ROLES = ['sales_admin', 'manager', 'admin'];
const ARCHIVER_ROLES = ['manager', 'admin'];
const DOC_OWNER_ROLES = ['f_and_i', 'manager', 'admin'];

// ---- helpers ---------------------------------------------------------------

const hasRole = (profile, roles) => !!profile && roles.includes(profile.role);

// ---- quotes ----------------------------------------------------------------

/**
 * Can this user approve this quote?
 * Sales admins approving their OWN quote => auto-approve path (still allowed).
 * Salesperson approving own quote => NO (even if they were promoted, the
 *   self-approval path is reserved for sales_admin/manager/admin).
 */
export function canApprove(profile, quote) {
  if (!profile || !quote) return false;
  if (quote.status !== 'pending_approval') return false;
  if (quote.archived_at) return false;
  return hasRole(profile, APPROVER_ROLES);
}

/**
 * Should this quote auto-approve at insert time?
 * True only if creator is sales_admin/manager/admin AND they are the salesperson.
 */
export function shouldAutoApprove(profile) {
  return hasRole(profile, APPROVER_ROLES);
}

export function canMarkDelivered(profile, quote) {
  if (!profile || !quote) return false;
  if (quote.status !== 'approved') return false;
  if (quote.archived_at) return false;
  // salesperson on their own quote, or any approver
  return quote.salesperson_id === profile.id || hasRole(profile, APPROVER_ROLES);
}

export function canMarkLost(profile, quote) {
  if (!profile || !quote) return false;
  if (quote.archived_at) return false;
  if (!['pending_approval', 'approved'].includes(quote.status)) return false;
  return quote.salesperson_id === profile.id || hasRole(profile, APPROVER_ROLES);
}

export function canArchiveManual(profile, quote) {
  if (!profile || !quote) return false;
  if (quote.archived_at) return false;
  return hasRole(profile, ARCHIVER_ROLES);
}

export function canUnarchive(profile, quote) {
  if (!profile || !quote) return false;
  if (!quote.archived_at) return false;
  // Don't let anyone unarchive an auto-archived Lost — that's the cron's job.
  // Manager/admin can override if they really need to.
  return hasRole(profile, ARCHIVER_ROLES);
}

export function canEditQuote(profile, quote) {
  if (!profile || !quote) return false;
  if (quote.archived_at) return false;
  if (quote.status === 'delivered') return false;
  return quote.salesperson_id === profile.id || hasRole(profile, APPROVER_ROLES);
}

// ---- doc requests ----------------------------------------------------------

export function canMarkDocIncomplete(profile, doc) {
  if (!profile || !doc) return false;
  if (doc.status !== 'pending') return false;
  return hasRole(profile, DOC_OWNER_ROLES);
}

export function canMarkDocReady(profile, doc) {
  if (!profile || !doc) return false;
  if (doc.status !== 'pending') return false;
  return hasRole(profile, DOC_OWNER_ROLES);
}

export function canReopenDocAsJoe(profile, doc) {
  if (!profile || !doc) return false;
  if (doc.status !== 'incomplete') return false;
  return hasRole(profile, DOC_OWNER_ROLES);
}

/**
 * Salesperson clicks "Request Update" on an Incomplete doc to flip it
 * back to Pending and notify Joe.
 */
export function canRequestDocUpdate(profile, doc, quote) {
  if (!profile || !doc || !quote) return false;
  if (doc.status !== 'incomplete') return false;
  return quote.salesperson_id === profile.id;
}
