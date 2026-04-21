import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from '../lib/audit';

/**
 * Deal Number tab.
 * - For salespeople: shows their quotes that have a deal number.
 * - For sales admins/managers: also shows a pending-request queue
 *   at the top where they can assign deal numbers.
 */
export default function DealNumberTab({ currentUserId, isSalesAdmin }) {
  const [quotes, setQuotes] = useState([]);
  const [pending, setPending] = useState([]); // sales admin only
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({}); // { [quoteId]: dealNumberString }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesAdmin, currentUserId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadAssigned(), isSalesAdmin ? loadPending() : Promise.resolve()]);
    setLoading(false);
  }

  async function loadAssigned() {
    let query = supabase
  .from('quotes')
  .select('*')
  .not('deal_number', 'is', null)
  .neq('deal_number', '')
  .eq('archived', false)
  .order('deal_number_assigned_at', { ascending: false, nullsFirst: false });

    if (!isSalesAdmin && currentUserId) {
      query = query.eq('salesperson_id', currentUserId);
    }

    const { data, error } = await query;
    if (error) console.error('loadAssigned error:', error);
    setQuotes(data ?? []);
  }

  async function loadPending() {
    // Uses the view created in migration
    const { data, error } = await supabase
      .from('v_pending_deal_number_requests')
      .select('*');
    if (error) console.error('loadPending error:', error);
    setPending(data ?? []);
  }

  async function assignDealNumber(quote) {
    const dealNum = (assigning[quote.id] ?? '').trim();
    if (!dealNum) {
      alert('Enter a deal number first.');
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('quotes')
      .update({
        deal_number: dealNum,
        deal_number_assigned_at: now,
        deal_number_assigned_by: currentUserId,
      })
      .eq('id', quote.id);

    if (error) {
      alert('Could not assign deal number: ' + error.message);
      return;
    }

    await logAuditEvent({
      tableName: 'quotes',
      recordId: quote.id,
      action: 'deal_number_assigned',
      newValue: dealNum,
      context: { quote_number: quote.quote_number, assigned_to: quote.salesperson_name },
    });

    setAssigning((s) => ({ ...s, [quote.id]: '' }));
    loadAll();
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 space-y-6">
      {isSalesAdmin && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xl font-bold text-white">Pending Deal # Requests</h2>
            {pending.length > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-bold">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div className="text-gray-500 text-sm italic">No pending requests.</div>
          ) : (
            <div className="overflow-x-auto border border-yellow-900/40 rounded-lg">
              <table className="w-full">
                <thead className="bg-yellow-900/20">
                  <tr className="text-left text-yellow-200 text-sm">
                    <th className="p-3">Quote #</th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Requested</th>
                    <th className="p-3">Assign Deal #</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((q) => (
                    <tr key={q.id} className="border-t border-gray-800">
                      <td className="p-3">
                        <Link to={`/quotes/${q.id}`} className="text-blue-400 hover:underline">
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="p-3 text-white">{q.salesperson_name ?? '—'}</td>
                      <td className="p-3 text-gray-200">{q.customer_name}</td>
                      <td className="p-3 text-gray-400 text-sm">
                        {new Date(q.deal_number_requested_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Deal #"
                            value={assigning[q.id] ?? ''}
                            onChange={(e) =>
                              setAssigning((s) => ({ ...s, [q.id]: e.target.value }))
                            }
                            className="bg-gray-900 border border-gray-700 text-white px-2 py-1 rounded w-32"
                          />
                          <button
                            onClick={() => assignDealNumber(q)}
                            className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-sm"
                          >
                            Assign
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold text-white mb-3">Quotes with Deal #</h2>
        {quotes.length === 0 ? (
          <div className="text-gray-400 py-8 text-center">No deals yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="p-3">Deal #</th>
                  <th className="p-3">Quote #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-3 text-white font-mono">{q.deal_number}</td>
                    <td className="p-3">
                      <Link to={`/quotes/${q.id}`} className="text-blue-400 hover:underline">
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="p-3 text-white">{q.customer_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs">{q.status}</span>
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {q.deal_number_assigned_at
                        ? new Date(q.deal_number_assigned_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
