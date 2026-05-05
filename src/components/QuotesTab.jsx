import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { logAuditEvent } from '../lib/audit';
import MoveRequestModal from './MoveRequestModal';

/**
 * Quotes tab — shows quotes WITHOUT a deal number.
 * Primary action: New Quote. Row actions: Request Deal #, Move Request.
 */
export default function QuotesTab({ currentUserId, isSalesAdmin }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moveRequestQuote, setMoveRequestQuote] = useState(null); // quote obj when modal open

  useEffect(() => {
    loadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesAdmin, currentUserId]);

  async function loadQuotes() {
    setLoading(true);

    let query = supabase
      .from('quotes')
      .select('*')
      .or('deal_number.is.null,deal_number.eq.')
      .eq('archived', false)
      .order('created_at', { ascending: false });

    // Salespeople see only their own; sales admins/managers see all
    if (!isSalesAdmin && currentUserId) {
      query = query.eq('salesperson_id', currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('loadQuotes error:', error);
      setQuotes([]);
    } else {
      setQuotes(data ?? []);
    }
    setLoading(false);
  }

  async function requestDealNumber(quote) {
    if (quote.deal_number_requested_at) return; // already requested

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('quotes')
      .update({ deal_number_requested_at: now })
      .eq('id', quote.id);

    if (error) {
      alert('Could not request deal number: ' + error.message);
      return;
    }

    await logAuditEvent({
      tableName: 'quotes',
      recordId: quote.id,
      action: 'deal_number_requested',
      context: { quote_number: quote.quote_number, customer: quote.customer_name },
    });

    loadQuotes();
  }

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-dark-muted">Loading quotes…</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Quotes</h2>
        <Link
          to="/quotes/new"
          className="bg-ttc-blue hover:bg-ttc-blue-dark text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          + New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-gray-500 dark:text-dark-muted py-8 text-center">
          No open quotes. Start a new one to get rolling.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-ttc-card">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
              <tr className="text-left">
                <th className="p-3">Quote #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg"
                >
                  <td className="p-3">
                    <Link
                      to={`/quotes/${q.id}`}
                      className="text-ttc-blue hover:text-ttc-blue-dark dark:text-ttc-blue dark:hover:text-blue-300 font-numeric hover:underline"
                    >
                      {q.quote_number}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="text-gray-900 dark:text-dark-text">{q.customer_name}</div>
                    <div className="text-xs text-gray-500 dark:text-dark-muted">{q.company_name}</div>
                  </td>
                  <td className="p-3 text-gray-900 dark:text-dark-text">
                    {q.vehicle_year} {q.vehicle_make} {q.vehicle_model}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="p-3 text-gray-700 dark:text-dark-text">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    {q.deal_number_requested_at ? (
                      <span className="inline-block px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-medium">
                        Deal # Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => requestDealNumber(q)}
                        className="px-3 py-1 bg-ttc-blue hover:bg-ttc-blue-dark text-white rounded text-sm font-medium transition-colors"
                      >
                        Request Deal #
                      </button>
                    )}
                    <button
                      onClick={() => setMoveRequestQuote(q)}
                      className="px-3 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-dark-text rounded text-sm font-medium transition-colors"
                    >
                      Move Request
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {moveRequestQuote && (
        <MoveRequestModal
          quote={moveRequestQuote}
          currentUserId={currentUserId}
          onClose={() => setMoveRequestQuote(null)}
          onCreated={() => { setMoveRequestQuote(null); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  // Soft pastel backgrounds, dark text — readable on light AND dark themes
  const styles = {
    draft:             'bg-gray-100  text-gray-700  dark:bg-gray-800     dark:text-gray-300',
    pending:           'bg-amber-50  text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    pending_approval:  'bg-amber-50  text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    approved:          'bg-green-50  text-green-700 dark:bg-green-950/40 dark:text-green-300',
    sold:              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    lost:              'bg-red-50    text-red-700   dark:bg-red-950/40   dark:text-red-300',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{status ?? '—'}</span>;
}
