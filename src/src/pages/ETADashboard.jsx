import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

/**
 * Manager ETA Dashboard
 * - Team-wide summary cards
 * - Per-salesperson breakdown table (click to expand)
 * - Tabs: Deal ETA | Move Request ETA
 */
export default function ETADashboard() {
  const { user } = useAuth();
  const { isManager, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [salespeople, setSalespeople] = useState([]);
  const [quotes, setQuotes]           = useState([]);
  const [moves, setMoves]             = useState([]);
  const [tab, setTab]                 = useState('deals');       // 'deals' | 'moves'
  const [expanded, setExpanded]       = useState({});            // { [userId]: bool }

  // Redirect non-managers
  useEffect(() => {
    if (!roleLoading && !isManager) navigate('/');
  }, [roleLoading, isManager, navigate]);

  useEffect(() => {
    if (!isManager) return;
    loadAll();
  }, [isManager]);

  async function loadAll() {
    setLoading(true);
    const [sp, q, m] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').in('role', ['salesperson']),
      supabase.from('quotes').select('*').eq('archived', false),
      supabase.from('move_requests').select('*').in('status', ['pending', 'assigned', 'in_progress']),
    ]);

    if (sp.error) console.error(sp.error);
    if (q.error)  console.error(q.error);
    if (m.error)  console.error(m.error);

    setSalespeople(sp.data ?? []);
    setQuotes(q.data ?? []);
    setMoves(m.data ?? []);
    setLoading(false);
  }

  // ---------- TEAM-LEVEL STATS ----------
  const stats = useMemo(() => {
    const now = Date.now();
    const openQuotes      = quotes.filter(q => !q.deal_number || q.deal_number === '');
    const staleQuotes     = openQuotes.filter(q => daysSince(q.created_at, now) > 30);
    const awaitingDealNum = openQuotes.filter(q => q.deal_number_requested_at);
    const awaitingStale   = awaitingDealNum.filter(q => daysSince(q.deal_number_requested_at, now) > 3);
    const activeDeals     = quotes.filter(q =>
      q.deal_number && q.deal_number !== '' && !['sold','lost'].includes(q.status)
    );
    const pendingMoves    = moves.filter(m => m.status === 'pending');
    const overdueMoves    = moves.filter(m =>
      m.date_needed && new Date(m.date_needed) < new Date() && m.status !== 'completed'
    );

    return {
      openQuotes:      openQuotes.length,
      staleQuotes:     staleQuotes.length,
      awaitingDealNum: awaitingDealNum.length,
      awaitingStale:   awaitingStale.length,
      activeDeals:     activeDeals.length,
      pendingMoves:    pendingMoves.length,
      overdueMoves:    overdueMoves.length,
    };
  }, [quotes, moves]);

  // ---------- PER-SALESPERSON ROLLUP ----------
  const perSalesperson = useMemo(() => {
    const now = Date.now();

    return salespeople.map(sp => {
      const myQuotes = quotes.filter(q => q.salesperson_id === sp.id);
      const myMoves  = moves.filter(m => m.requester_id === sp.id);

      const openQuotes  = myQuotes.filter(q => !q.deal_number || q.deal_number === '');
      const staleQuotes = openQuotes.filter(q => daysSince(q.created_at, now) > 30);
      const awaiting    = openQuotes.filter(q => q.deal_number_requested_at);
      const activeDeals = myQuotes.filter(q =>
        q.deal_number && q.deal_number !== '' && !['sold','lost'].includes(q.status)
      );
      const pendingMv   = myMoves.filter(m => m.status === 'pending');
      const overdueMv   = myMoves.filter(m =>
        m.date_needed && new Date(m.date_needed) < new Date() && m.status !== 'completed'
      );

      // Avg days from request → assignment on their assigned deals
      const assignedWithTimestamps = myQuotes.filter(q =>
        q.deal_number_requested_at && q.deal_number_assigned_at
      );
      const avgDaysToDealNum = assignedWithTimestamps.length === 0
        ? null
        : (assignedWithTimestamps.reduce((sum, q) =>
            sum + daysBetween(q.deal_number_requested_at, q.deal_number_assigned_at), 0)
          / assignedWithTimestamps.length);

      return {
        id: sp.id,
        name: sp.full_name,
        openQuotes:  openQuotes.length,
        awaiting:    awaiting.length,
        activeDeals: activeDeals.length,
        avgDaysToDealNum,
        staleQuotes: staleQuotes.length,
        pendingMoves: pendingMv.length,
        overdueMoves: overdueMv.length,
        // for expansion
        myQuotes,
        myMoves,
      };
    });
  }, [salespeople, quotes, moves]);

  if (roleLoading || loading) {
    return <Shell><div className="p-8 text-gray-400">Loading ETA dashboard…</div></Shell>;
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Title row */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">ETA Dashboard</h1>
            <p className="text-sm text-gray-400">Team-wide pipeline health · Updated just now</p>
          </div>
          <button
            onClick={loadAll}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-sm"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card label="Open Quotes"      value={stats.openQuotes}      sub={`${stats.staleQuotes} stale (>30d)`}     tone={stats.staleQuotes > 0 ? 'warn' : 'ok'} />
          <Card label="Awaiting Deal #"  value={stats.awaitingDealNum} sub={`${stats.awaitingStale} over 3d`}         tone={stats.awaitingStale > 0 ? 'alert' : 'ok'} />
          <Card label="Active Deals"     value={stats.activeDeals}     sub="with deal # assigned"                     tone="neutral" />
          <Card label="Pending Moves"    value={stats.pendingMoves}    sub="awaiting porter assignment"               tone="neutral" />
          <Card label="Overdue Moves"    value={stats.overdueMoves}    sub="past date_needed"                         tone={stats.overdueMoves > 0 ? 'alert' : 'ok'} />
        </div>

        {/* Per-salesperson breakdown */}
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">By Salesperson</h2>
          {perSalesperson.length === 0 ? (
            <div className="text-gray-500 italic">No salespeople found.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr className="text-left">
                    <th className="p-3"></th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3 text-right">Open</th>
                    <th className="p-3 text-right">Awaiting #</th>
                    <th className="p-3 text-right">Active Deals</th>
                    <th className="p-3 text-right">Avg Days to #</th>
                    <th className="p-3 text-right">Stale ({'>'}30d)</th>
                    <th className="p-3 text-right">Pending Moves</th>
                    <th className="p-3 text-right">Overdue Moves</th>
                  </tr>
                </thead>
                <tbody>
                  {perSalesperson.map(sp => (
                    <RowWithDetail
                      key={sp.id}
                      sp={sp}
                      isOpen={!!expanded[sp.id]}
                      onToggle={() => setExpanded(e => ({ ...e, [sp.id]: !e[sp.id] }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Detail tabs */}
        <section>
          <div className="flex gap-1 border-b border-gray-800 mb-4">
            <TabBtn active={tab === 'deals'} onClick={() => setTab('deals')}>Deal ETA</TabBtn>
            <TabBtn active={tab === 'moves'} onClick={() => setTab('moves')}>Move Request ETA</TabBtn>
          </div>

          {tab === 'deals' ? (
            <DealETATable quotes={quotes} salespeople={salespeople} />
          ) : (
            <MoveETATable moves={moves} salespeople={salespeople} />
          )}
        </section>
      </div>
    </Shell>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function Shell({ children }) {
  const { signOut } = useAuth();
  const { profile, role } = useUserRole();
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-orange-500 font-black text-xl tracking-wider">TTC</span>
            <span className="text-white font-semibold">TruckQuote Pro</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              {profile?.full_name}
              <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded text-xs capitalize">
                {role?.replace('_',' ')}
              </span>
            </span>
            <Link to="/" className="text-gray-300 hover:text-white">Dashboard</Link>
            <Link to="/stats" className="text-gray-300 hover:text-white">Stats</Link>
            <Link to="/settings" className="text-gray-300 hover:text-white">Settings</Link>
            <button onClick={signOut} className="text-gray-400 hover:text-white">Sign out</button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function Card({ label, value, sub, tone = 'neutral' }) {
  const tones = {
    ok:      'border-gray-800',
    neutral: 'border-gray-800',
    warn:    'border-yellow-600/40',
    alert:   'border-red-600/50',
  };
  const subTones = {
    ok:      'text-gray-500',
    neutral: 'text-gray-500',
    warn:    'text-yellow-400',
    alert:   'text-red-400',
  };
  return (
    <div className={`bg-gray-900 rounded-lg p-4 border ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-3xl font-bold text-white mt-1">{value}</div>
      <div className={`text-xs mt-1 ${subTones[tone]}`}>{sub}</div>
    </div>
  );
}

function RowWithDetail({ sp, isOpen, onToggle }) {
  return (
    <>
      <tr className="border-t border-gray-800 hover:bg-gray-900/70 cursor-pointer" onClick={onToggle}>
        <td className="p-3 text-gray-500 w-8">{isOpen ? '▼' : '▶'}</td>
        <td className="p-3 text-white font-medium">{sp.name}</td>
        <td className="p-3 text-right">{sp.openQuotes}</td>
        <td className="p-3 text-right">{sp.awaiting}</td>
        <td className="p-3 text-right">{sp.activeDeals}</td>
        <td className="p-3 text-right text-gray-300">
          {sp.avgDaysToDealNum == null ? '—' : `${sp.avgDaysToDealNum.toFixed(1)}d`}
        </td>
        <td className="p-3 text-right">
          <AgingBadge count={sp.staleQuotes} zero="ok" />
        </td>
        <td className="p-3 text-right">{sp.pendingMoves}</td>
        <td className="p-3 text-right">
          <AgingBadge count={sp.overdueMoves} zero="ok" level="alert" />
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-900/40">
          <td></td>
          <td colSpan={8} className="p-3">
            <SalespersonDetail sp={sp} />
          </td>
        </tr>
      )}
    </>
  );
}

function SalespersonDetail({ sp }) {
  const now = Date.now();
  return (
    <div className="space-y-4">
      {/* Active quotes */}
      <div>
        <div className="text-sm font-semibold text-gray-300 mb-2">Open Quotes ({sp.myQuotes.filter(q => !q.deal_number).length})</div>
        {sp.myQuotes.filter(q => !q.deal_number).length === 0 ? (
          <div className="text-xs text-gray-500 italic">None open.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr className="text-left">
                <th className="py-1">Quote #</th>
                <th className="py-1">Customer</th>
                <th className="py-1">Status</th>
                <th className="py-1 text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {sp.myQuotes.filter(q => !q.deal_number).map(q => {
                const age = daysSince(q.created_at, now);
                return (
                  <tr key={q.id} className="border-t border-gray-800">
                    <td className="py-1">
                      <Link to={`/quotes/${q.id}`} className="text-blue-400 hover:underline">
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="py-1 text-gray-200">{q.customer_name}</td>
                    <td className="py-1 text-gray-400 text-xs">{q.status}</td>
                    <td className="py-1 text-right"><AgeLabel days={age} thresholds={[30,60]} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending / active moves */}
      <div>
        <div className="text-sm font-semibold text-gray-300 mb-2">Active Moves ({sp.myMoves.length})</div>
        {sp.myMoves.length === 0 ? (
          <div className="text-xs text-gray-500 italic">None active.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr className="text-left">
                <th className="py-1">From → To</th>
                <th className="py-1">Type</th>
                <th className="py-1">Status</th>
                <th className="py-1 text-right">Date Needed</th>
              </tr>
            </thead>
            <tbody>
              {sp.myMoves.map(m => (
                <tr key={m.id} className="border-t border-gray-800">
                  <td className="py-1 text-gray-200 text-xs">{m.from_location} → {m.to_location}</td>
                  <td className="py-1 text-gray-400 text-xs">{m.move_type}</td>
                  <td className="py-1 text-gray-400 text-xs">{m.status}</td>
                  <td className="py-1 text-right"><DateNeededLabel date={m.date_needed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DealETATable({ quotes, salespeople }) {
  const activeQuotes = quotes.filter(q => !['sold','lost'].includes(q.status));
  const now = Date.now();

  const rows = activeQuotes
    .map(q => ({
      ...q,
      age: daysSince(q.created_at, now),
      sp: salespeople.find(s => s.id === q.salesperson_id)?.full_name ?? '—',
    }))
    .sort((a,b) => b.age - a.age);

  if (rows.length === 0) return <div className="text-gray-500 italic">No active deals.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-gray-400 text-xs">
          <tr className="text-left">
            <th className="p-3">Quote #</th>
            <th className="p-3">Salesperson</th>
            <th className="p-3">Customer</th>
            <th className="p-3">Deal #</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(q => (
            <tr key={q.id} className="border-t border-gray-800 hover:bg-gray-900/70">
              <td className="p-3">
                <Link to={`/quotes/${q.id}`} className="text-blue-400 hover:underline">{q.quote_number}</Link>
              </td>
              <td className="p-3 text-gray-200">{q.sp}</td>
              <td className="p-3 text-gray-200">{q.customer_name}</td>
              <td className="p-3 text-gray-300 font-mono">{q.deal_number || '—'}</td>
              <td className="p-3 text-gray-400">{q.status}</td>
              <td className="p-3 text-right"><AgeLabel days={q.age} thresholds={[30,60]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoveETATable({ moves, salespeople }) {
  const rows = moves
    .map(m => ({
      ...m,
      sp: salespeople.find(s => s.id === m.requester_id)?.full_name ?? '—',
    }))
    .sort((a,b) => {
      // overdue first, then by date_needed ascending
      const aOv = isOverdue(a);
      const bOv = isOverdue(b);
      if (aOv !== bOv) return aOv ? -1 : 1;
      return (new Date(a.date_needed ?? 0)) - (new Date(b.date_needed ?? 0));
    });

  if (rows.length === 0) return <div className="text-gray-500 italic">No active moves.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900 text-gray-400 text-xs">
          <tr className="text-left">
            <th className="p-3">From → To</th>
            <th className="p-3">Requester</th>
            <th className="p-3">Type</th>
            <th className="p-3">Region</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Date Needed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id} className={`border-t border-gray-800 hover:bg-gray-900/70 ${m.is_urgent ? 'bg-red-950/30' : ''}`}>
              <td className="p-3 text-gray-200">{m.from_location} → {m.to_location}</td>
              <td className="p-3 text-gray-300">{m.sp}</td>
              <td className="p-3 text-gray-400">{m.move_type}</td>
              <td className="p-3 text-gray-400">{m.region}</td>
              <td className="p-3">
                <span className="px-2 py-0.5 bg-gray-800 rounded text-xs">{m.status}</span>
                {m.is_urgent && <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">URGENT</span>}
              </td>
              <td className="p-3 text-right"><DateNeededLabel date={m.date_needed} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
        active ? 'text-orange-400 border-orange-500' : 'text-gray-400 border-transparent hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function AgingBadge({ count, level = 'warn', zero = 'dim' }) {
  if (count === 0) {
    return <span className="text-gray-600">0</span>;
  }
  const cls = level === 'alert' ? 'text-red-400 font-semibold' : 'text-yellow-400 font-semibold';
  return <span className={cls}>{count}</span>;
}

function AgeLabel({ days, thresholds = [30, 60] }) {
  const [warn, alert] = thresholds;
  let cls = 'text-green-400';
  if (days >= alert) cls = 'text-red-400 font-semibold';
  else if (days >= warn) cls = 'text-yellow-400';
  return <span className={cls}>{Math.round(days)}d</span>;
}

function DateNeededLabel({ date }) {
  if (!date) return <span className="text-gray-500">—</span>;
  const d = new Date(date);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((d - now) / dayMs);

  let cls = 'text-green-400';
  let label = d.toLocaleDateString();

  if (diffDays < 0)      { cls = 'text-red-400 font-semibold'; label += ` (${Math.abs(diffDays)}d late)`; }
  else if (diffDays <= 1){ cls = 'text-yellow-400'; label += diffDays === 0 ? ' (today)' : ' (tomorrow)'; }

  return <span className={cls}>{label}</span>;
}

// ============================================================================
// HELPERS
// ============================================================================

function daysSince(iso, nowMs) {
  if (!iso) return 0;
  return (nowMs - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}
function daysBetween(isoA, isoB) {
  return (new Date(isoB).getTime() - new Date(isoA).getTime()) / (1000 * 60 * 60 * 24);
}
function isOverdue(m) {
  return m.date_needed && new Date(m.date_needed) < new Date() && m.status !== 'completed';
}

