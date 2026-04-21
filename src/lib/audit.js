import { supabase } from './supabase';

/**
 * Writes a human-readable audit entry. The DB trigger already logs
 * field-level diffs on insert/update/delete — this helper is for
 * SEMANTIC events we want to show in the timeline UI with nice text.
 *
 * Example usage:
 *   await logAuditEvent({
 *     tableName: 'quotes',
 *     recordId: quote.id,
 *     action: 'deal_number_requested',
 *     context: { quoteId: quote.id, customer: quote.customer_name }
 *   });
 */
export async function logAuditEvent({
  tableName,
  recordId,
  action,
  fieldName = null,
  oldValue = null,
  newValue = null,
  context = null,
}) {
  const { data: { user } } = await supabase.auth.getUser();

  let changedByName = null;
  if (user?.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    changedByName = profile?.full_name ?? null;
  }

  const { error } = await supabase.from('audit_log').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    field_name: fieldName,
    old_value: oldValue != null ? String(oldValue) : null,
    new_value: newValue != null ? String(newValue) : null,
    changed_by: user?.id ?? null,
    changed_by_name: changedByName,
    context,
  });

  if (error) {
    // Non-fatal: audit write failures shouldn't break user flow
    console.error('logAuditEvent error:', error);
  }
}

/**
 * Formats an audit row for display in a timeline.
 * Returns { icon, text, actor, when }.
 */
export function formatAuditEntry(row) {
  const actor = row.changed_by_name ?? 'System';
  const when = new Date(row.changed_at).toLocaleString();

  let text = '';
  let icon = '•';

  switch (row.action) {
    case 'insert':
      text = `Created ${row.table_name === 'quotes' ? 'quote' : 'move request'}`;
      icon = '✨';
      break;
    case 'delete':
      text = `Deleted record`;
      icon = '🗑️';
      break;
    case 'deal_number_requested':
      text = 'Requested deal number';
      icon = '📮';
      break;
    case 'deal_number_assigned':
      text = `Assigned deal #${row.new_value ?? ''}`;
      icon = '🎫';
      break;
    case 'status_change':
      text = `Changed status: ${row.old_value ?? '—'} → ${row.new_value ?? '—'}`;
      icon = '🔄';
      break;
    case 'move_assigned':
      text = `Assigned porter`;
      icon = '🚚';
      break;
    case 'update':
      text = `Updated ${row.field_name}: ${row.old_value ?? '—'} → ${row.new_value ?? '—'}`;
      icon = '✏️';
      break;
    default:
      text = row.action;
  }

  return { icon, text, actor, when };
}
