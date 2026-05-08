import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from '../lib/audit';
import MoveRequestModal from './MoveRequestModal';
import DocRequestModal from './DocRequestModal';
import { DocStatusBadge } from './StatusBadge';

/**
 * Deal Number tab.
 * - Sales admins/managers see a pending-request queue at the top.
 * - All users see their assigned-deal quotes below, with per-row
 *   Move Request and Doc Request action buttons.
 */
export default function DealNumberTab({ currentUserId, isSalesAdmin }) {
  const [quotes, setQuotes] = useState([]);
  const [docRequestsByQuote, setDocRequestsByQuote] = useState({}); // { quote_id: latest doc_request }
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});

  // Modals
  const [moveRequestQuote, setMoveRequestQuote] = useState(null);
  const [docRequestQuote, setDocRequestQuote] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesAdmin, currentUserId]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([
      loadAssigned(),
      isSalesAdmin ? loadPending() : Promise.resolve(),
    ]);
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
    if (error) {
      console.error('loadAssigned error:', error);
      setQuotes([]);
      setDocRequestsByQuote({});
      return;
    }
    setQuotes(data ?? []);

    // Pull latest doc_request per quote in one query (avoids N+1)
    const ids = (data ?? []).map((q) => q.id);
    if (ids.length) {
      const { data: drs } = await supabase
        .from('doc_requests')
        .select('*')
        .in('quote_id', ids)
        .order('created_at', { ascending: false });

      // Keep only the newest per quote_id
      const byQuote = {};
      (drs ?? []).forEach((dr) => {
        if (!byQuote[dr.quote_id]) byQuote[dr.quote_id] = dr;
      });
      setDocRequestsByQuote(byQuote);
    } else {
      setDocRequestsByQuote({});
    }
  }

  async function loadPending() {
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

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-dark-muted">Loading…</div>;
  }

  return (
    <div className="p-4 space-y-6">
      {isSalesAdmin && (
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">
              Pending Deal # Requests
            </h2>
            {pending.length > 0 && (
              <span className="px-2 py-0.5 bg-stat-red text-white rounded-full text-xs font-bold">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div className="text-gray-500 dark:text-dark-muted text-sm italic">
              No pending requests.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 border-l-4 border-l-amber-400 dark:border-l-amber-500 shadow-ttc-card">
              <table className="w-full">
                <thead className="bg-amber-100/60 dark:bg-amber-900/30 text-xs uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  <tr className="text-left">
                    <th className="p-3">Quote #</th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Requested</th>
                    <th className="p-3">Assign Deal #</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((q) => (
                    <tr key={q.id} className="border-t border-amber-200/60 dark:border-amber-900/40">
                      <td className="p-3">
                        <Link
                          to={`/quotes/${q.id}`}
                          className="text-ttc-blue hover:text-ttc-blue-dark dark:text-ttc-blue dark:hover:text-blue-300 font-numeric hover:underline"
                        >
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="p-3 text-gray-900 dark:text-dark-text">
                        {q.salesperson_name ?? '—'}
                      </td>
                      <td className="p-3 text-gray-700 dark:text-dark-text">{q.customer_name}</td>
                      <td className="p-3 text-gray-600 dark:text-dark-muted text-sm">
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
                            className="bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border text-gray-900 dark:text-dark-text px-2 py-1 rounded-md w-32 focus:outline-none focus:ring-2 focus:ring-ttc-blue focus:border-transparent font-numeric"
                          />
                          <button
                            onClick={() => assignDealNumber(q)}
                            className="px-3 py-1 bg-ttc-blue hover:bg-ttc-blue-dark text-white rounded-md text-sm font-medium transition-colors"
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text mb-3">
          Quotes with Deal #
        </h2>
        {quotes.length === 0 ? (
          <div className="text-gray-500 dark:text-dark-muted py-8 text-center">No deals yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-ttc-card">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
                <tr className="text-left">
                  <th className="p-3">Deal #</th>
                  <th className="p-3">Quote #</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const dr = docRequestsByQuote[q.id];
                  return (
                    <tr
                      key={q.id}
                      className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg"
                    >
                      <td className="p-3 text-gray-900 dark:text-dark-text font-numeric">
                        {q.deal_number}
                      </td>
                      <td className="p-3">
                        <Link
                          to={`/quotes/${q.id}`}
                          className="text-ttc-blue hover:text-ttc-blue-dark dark:text-ttc-blue dark:hover:text-blue-300 font-numeric hover:underline"
                        >
                          {q.quote_number}
                        </Link>
                      </td>
                      <td className="p-3 text-gray-900 dark:text-dark-text">{q.customer_name}</td>
                      <td className="p-3">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="p-3 text-gray-600 dark:text-dark-muted text-sm">
                        {q.deal_number_assigned_at
                          ? new Date(q.deal_number_assigned_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setMoveRequestQuote(q)}
                          className="px-3 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text rounded text-sm font-medium transition-colors"
                        >
                          Move Request
                        </button>
                        {dr ? (
                          <Link
                            to={`/quotes/${q.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text rounded text-sm font-medium transition-colors"
                            title="View doc request"
                          >
                            Doc Request <DocStatusBadge doc={dr} />
                          </Link>
                        ) : (
                          <button
                            onClick={() => setDocRequestQuote(q)}
                            className="px-3 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text rounded text-sm font-medium transition-colors"
                          >
                            Doc Request
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {moveRequestQuote && (
        <MoveRequestModal
          quote={moveRequestQuote}
          currentUserId={currentUserId}
          onClose={() => setMoveRequestQuote(null)}
          onCreated={() => { setMoveRequestQuote(null); }}
        />
      )}

      {docRequestQuote && (
        <DocRequestModal
          quote={docRequestQuote}
          currentUserId={currentUserId}
          onClose={() => setDocRequestQuote(null)}
          onCreated={() => { setDocRequestQuote(null); loadAll(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending_approval:  'bg-amber-50  text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    approved:          'bg-green-50  text-green-700 dark:bg-green-950/40 dark:text-green-300',
    delivered:         'bg-blue-50   text-blue-700  dark:bg-blue-950/40  dark:text-blue-300',
    lost:              'bg-red-50    text-red-700   dark:bg-red-950/40   dark:text-red-300',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{status ?? '—'}</span>;
}
