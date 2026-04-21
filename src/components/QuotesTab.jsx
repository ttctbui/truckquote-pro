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
      .is('deal_number', null)
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

  if (loading) return <div className="p-6 text-gray-400">Loading quotes…</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Quotes</h2>
        <Link
          to="/quotes/new"
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">
          No open quotes. Start a new one to get rolling.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
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
                <tr key={q.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-3">
                    <Link to={`/quotes/${q.id}`} className="text-blue-400 hover:underline">
                      {q.quote_number}
                    </Link>
                  </td>
                  <td className="p-3 text-white">
                    <div>{q.customer_name}</div>
                    <div className="text-xs text-gray-500">{q.company_name}</div>
                  </td>
                  <td className="p-3 text-white">
                    {q.vehicle_year} {q.vehicle_make} {q.vehicle_model}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="p-3 text-gray-300">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    {q.deal_number_requested_at ? (
                      <span className="inline-block px-3 py-1 bg-yellow-900/40 text-yellow-300 rounded text-xs">
                        Deal # Requested
                      </span>
                    ) : (
                      <button
                        onClick={() => requestDealNumber(q)}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-sm"
                      >
                        Request Deal #
                      </button>
                    )}
                    <button
                      onClick={() => setMoveRequestQuote(q)}
                      className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm"
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
  const styles = {
    draft:    'bg-gray-700 text-gray-200',
    pending:  'bg-yellow-800 text-yellow-200',
    approved: 'bg-green-800 text-green-200',
    sold:     'bg-emerald-700 text-white',
    lost:     'bg-red-900 text-red-200',
  };
  const cls = styles[status] ?? 'bg-gray-700 text-gray-200';
  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{status ?? '—'}</span>;
}
