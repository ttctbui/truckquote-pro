import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import MoveRequestModal from './MoveRequestModal';

/**
 * Move Request tab.
 * Two sections: tied to a quote, and standalone (event washes, etc.)
 */
export default function MoveRequestTab({ currentUserId, isSalesAdmin }) {
  const [tied, setTied] = useState([]);
  const [standalone, setStandalone] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesAdmin, currentUserId]);

  async function load() {
    setLoading(true);

    // Join quotes for context on tied requests
    let tiedQ = supabase
      .from('move_requests')
      .select('*, quotes(quote_number, customer_name)')
      .not('quote_id', 'is', null)
      .order('created_at', { ascending: false });

    let stdQ = supabase
      .from('move_requests')
      .select('*')
      .is('quote_id', null)
      .order('created_at', { ascending: false });

    if (!isSalesAdmin && currentUserId) {
      tiedQ = tiedQ.eq('requester_id', currentUserId);
      stdQ = stdQ.eq('requester_id', currentUserId);
    }

    const [tiedRes, stdRes] = await Promise.all([tiedQ, stdQ]);
    if (tiedRes.error) console.error(tiedRes.error);
    if (stdRes.error) console.error(stdRes.error);

    setTied(tiedRes.data ?? []);
    setStandalone(stdRes.data ?? []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-dark-muted">Loading move requests…</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Move Requests</h2>
        <button
          onClick={() => setNewModal(true)}
          className="bg-ttc-blue hover:bg-ttc-blue-dark text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          + New Move Request
        </button>
      </div>

      <Section
        title="Tied to a Quote"
        subtitle="Moves requested in connection with a specific quote"
        rows={tied}
        showQuote
      />

      <Section
        title="Standalone"
        subtitle="Event washes, rentals, and other non-quote moves"
        rows={standalone}
      />

      {newModal && (
        <MoveRequestModal
          quote={null}
          currentUserId={currentUserId}
          onClose={() => setNewModal(false)}
          onCreated={() => { setNewModal(false); load(); }}
        />
      )}
    </div>
  );
}

function Section({ title, subtitle, rows, showQuote = false }) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-dark-muted">{subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-gray-500 dark:text-dark-muted text-sm italic py-4">None.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-ttc-card">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
              <tr className="text-left">
                {showQuote && <th className="p-3">Quote #</th>}
                <th className="p-3">Vehicle / Customer</th>
                <th className="p-3">From → To</th>
                <th className="p-3">Type</th>
                <th className="p-3">Region</th>
                <th className="p-3">Status</th>
                <th className="p-3">ETA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg"
                >
                  {showQuote && (
                    <td className="p-3">
                      <span className="text-ttc-blue font-numeric">
                        {r.quotes?.quote_number ?? '—'}
                      </span>
                    </td>
                  )}
                  <td className="p-3">
                    <div className="text-gray-900 dark:text-dark-text">{r.vin_stock_tag ?? '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-dark-muted">
                      {r.customer ?? r.quotes?.customer_name ?? ''}
                    </div>
                  </td>
                  <td className="p-3 text-gray-700 dark:text-dark-text text-sm">
                    {r.from_location} → {r.to_location}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-dark-text text-sm">
                    {r.move_type ?? '—'}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-dark-text text-sm">
                    {r.region ?? '—'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={r.status} urgent={r.is_urgent} />
                  </td>
                  <td className="p-3 text-gray-600 dark:text-dark-muted text-sm">
                    {r.eta ? new Date(r.eta).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status, urgent }) {
  const styles = {
    pending:     'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    assigned:    'bg-blue-50  text-blue-700  dark:bg-blue-950/40  dark:text-blue-300',
    in_progress: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    completed:   'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    cancelled:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return (
    <span className="inline-flex items-center gap-1">
      {urgent && (
        <span className="px-1.5 py-0.5 bg-stat-red text-white rounded text-[10px] font-bold">
          URGENT
        </span>
      )}
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
        {status ?? '—'}
      </span>
    </span>
  );
}
