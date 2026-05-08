import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DocStatusBadge } from './StatusBadge';

/**
 * DocRequestsTab — list view of all doc requests across all quotes.
 * F&I (Joe) lives here. Salespeople see their own; managers/admins see all.
 *
 * Filters: All / Pending / Incomplete / Ready
 * Default: 'pending' for f_and_i, 'all' for everyone else
 *
 * NOTE: We fetch doc_requests and quotes separately, then merge in JS.
 * Earlier version used a Supabase FK embed which was failing silently
 * because the auto-generated FK constraint name didn't match expectations.
 */
export default function DocRequestsTab({ currentUserId, role }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(role === 'f_and_i' ? 'pending' : 'all');

  const isAllAccess = ['f_and_i', 'manager', 'admin', 'sales_admin'].includes(role);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, role]);

  async function load() {
    setLoading(true);

    const { data: docs, error: docsErr } = await supabase
      .from('doc_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (docsErr) {
      console.error('DocRequestsTab doc_requests load error:', docsErr);
      setRows([]);
      setLoading(false);
      return;
    }

    const quoteIds = [...new Set((docs ?? []).map((d) => d.quote_id).filter(Boolean))];
    let quotesById = {};
    if (quoteIds.length) {
      const { data: quotes, error: qErr } = await supabase
        .from('quotes')
        .select('id, quote_number, customer_name, deal_number, salesperson_id, salesperson_name')
        .in('id', quoteIds);
      if (qErr) {
        console.error('DocRequestsTab quotes load error:', qErr);
      } else {
        quotesById = Object.fromEntries((quotes ?? []).map((q) => [q.id, q]));
      }
    }

    const merged = (docs ?? []).map((d) => ({ ...d, quote: quotesById[d.quote_id] || null }));

    // Salesperson scope: only their own. Sales admins/managers/admins/F&I see all.
    const filtered = isAllAccess
      ? merged
      : merged.filter((r) => r.quote?.salesperson_id === currentUserId);

    setRows(filtered);
    setLoading(false);
  }

  const visible = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter((r) => r.status === 'pending').length,
    incomplete: rows.filter((r) => r.status === 'incomplete').length,
    ready: rows.filter((r) => r.status === 'ready').length,
  }), [rows]);

  if (loading) {
    return <div className="p-6 text-gray-500 dark:text-dark-muted">Loading doc requests…</div>;
  }

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Doc Requests</h2>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all}>
            All
          </FilterChip>
          <FilterChip active={filter === 'pending'} onClick={() => setFilter('pending')} count={counts.pending} accent="amber">
            Pending
          </FilterChip>
          <FilterChip active={filter === 'incomplete'} onClick={() => setFilter('incomplete')} count={counts.incomplete} accent="red">
            Incomplete
          </FilterChip>
          <FilterChip active={filter === 'ready'} onClick={() => setFilter('ready')} count={counts.ready} accent="green">
            Ready
          </FilterChip>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-gray-500 dark:text-dark-muted py-8 text-center">
          {filter === 'all'
            ? 'No doc requests yet.'
            : `No ${filter} doc requests.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-ttc-card">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
              <tr className="text-left">
                <th className="p-3">Deal #</th>
                <th className="p-3">Quote #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Salesperson</th>
                <th className="p-3">Status</th>
                <th className="p-3">Waiting</th>
                <th className="p-3">Last Activity</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const quote = r.quote;
                const waitingDays = waitingDaysSince(r);
                const lastActivity = lastActivityIso(r);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg"
                  >
                    <td className="p-3 text-gray-900 dark:text-dark-text font-numeric">
                      {quote?.deal_number ?? r.deal_number ?? '—'}
                    </td>
                    <td className="p-3">
                      {quote ? (
                        <Link
                          to={`/quotes/${quote.id}`}
                          className="text-ttc-blue hover:text-ttc-blue-dark dark:text-ttc-blue dark:hover:text-blue-300 font-numeric hover:underline"
                        >
                          {quote.quote_number}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-gray-900 dark:text-dark-text">
                      {quote?.customer_name ?? r.customer ?? '—'}
                    </td>
                    <td className="p-3 text-gray-700 dark:text-dark-text">
                      {quote?.salesperson_name ?? r.salesperson ?? '—'}
                    </td>
                    <td className="p-3">
                      <DocStatusBadge doc={r} />
                    </td>
                    <td className="p-3 text-gray-700 dark:text-dark-text font-numeric">
                      {r.status === 'ready' ? '—' : waitingDays != null ? `${waitingDays}d` : '—'}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-dark-muted text-sm">
                      {lastActivity ? new Date(lastActivity).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right">
                      {quote && (
                        <Link
                          to={`/quotes/${quote.id}`}
                          className="px-3 py-1 bg-ttc-blue hover:bg-ttc-blue-dark text-white rounded text-sm font-medium transition-colors"
                        >
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, count, accent, children }) {
  const accentMap = {
    amber: 'border-amber-300 dark:border-amber-700',
    red:   'border-red-300 dark:border-red-700',
    green: 'border-green-300 dark:border-green-700',
  };
  const accentCls = accentMap[accent] || 'border-gray-300 dark:border-dark-border';
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? 'bg-ttc-blue border-ttc-blue text-white'
          : `bg-white dark:bg-dark-surface ${accentCls} text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-bg`
      }`}
    >
      {children}
      {count > 0 && (
        <span className={`ml-1.5 inline-block min-w-[18px] text-center ${active ? 'text-white' : 'text-gray-500 dark:text-dark-muted'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function waitingDaysSince(r) {
  let anchor;
  if (r.status === 'pending') {
    anchor = r.last_update_requested_at || r.pending_at || r.created_at;
  } else if (r.status === 'incomplete') {
    anchor = r.incomplete_at || r.created_at;
  } else {
    return null;
  }
  if (!anchor) return null;
  const ms = Date.now() - new Date(anchor).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function lastActivityIso(r) {
  return (
    r.ready_at ||
    r.last_update_requested_at ||
    r.incomplete_at ||
    r.pending_at ||
    r.created_at ||
    null
  );
}
