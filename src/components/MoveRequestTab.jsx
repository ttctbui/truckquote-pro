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

  if (loading) return <div className="p-6 text-gray-400">Loading move requests…</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Move Requests</h2>
        <button
          onClick={() => setNewModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold"
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
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-gray-500 text-sm italic py-4">None.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700 text-sm">
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
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                  {showQuote && (
                    <td className="p-3 text-blue-400">{r.quotes?.quote_number ?? '—'}</td>
                  )}
                  <td className="p-3 text-white">
                    <div>{r.vin_stock_tag ?? '—'}</div>
                    <div className="text-xs text-gray-500">{r.customer ?? r.quotes?.customer_name ?? ''}</div>
                  </td>
                  <td className="p-3 text-gray-200 text-sm">
                    {r.from_location} → {r.to_location}
                  </td>
                  <td className="p-3 text-gray-300 text-sm">{r.move_type ?? '—'}</td>
                  <td className="p-3 text-gray-300 text-sm">{r.region ?? '—'}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} urgent={r.is_urgent} />
                  </td>
                  <td className="p-3 text-gray-400 text-sm">
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
    pending:     'bg-yellow-800 text-yellow-200',
    assigned:    'bg-blue-800 text-blue-200',
    in_progress: 'bg-purple-800 text-purple-200',
    completed:   'bg-green-800 text-green-200',
    cancelled:   'bg-gray-700 text-gray-300',
  };
  return (
    <span className="inline-flex items-center gap-1">
      {urgent && <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">URGENT</span>}
      <span className={`px-2 py-1 rounded text-xs ${styles[status] ?? 'bg-gray-700'}`}>
        {status ?? '—'}
      </span>
    </span>
  );
}
