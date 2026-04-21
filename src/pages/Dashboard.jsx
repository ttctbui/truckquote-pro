import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import QuotesTab from '../components/QuotesTab';
import DealNumberTab from '../components/DealNumberTab';
import MoveRequestTab from '../components/MoveRequestTab';

/**
 * Refactored Dashboard — three tabs: Quotes / Deal Number / Move Request.
 * Managers get an extra link to the ETA dashboard (Phase 4).
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { profile, role, isSalesAdmin, isManager, loading } = useUserRole();
  const [tab, setTab] = useState('quotes');

  if (loading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-orange-500 font-black text-xl tracking-wider">TTC</span>
            <span className="text-white font-semibold">TruckQuote Pro</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              {profile?.full_name ?? user?.email}
              <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded text-xs capitalize">
                {role.replace('_', ' ')}
              </span>
            </span>
            {isManager && (
              <a href="/eta-dashboard" className="text-orange-400 hover:text-orange-300">
                ETA Dashboard
              </a>
            )}
            <a href="/stats" className="text-gray-300 hover:text-white">Stats</a>
            <a href="/settings" className="text-gray-300 hover:text-white">Settings</a>
            <button onClick={signOut} className="text-gray-400 hover:text-white">Sign out</button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="max-w-7xl mx-auto px-4 flex gap-1">
          <TabButton active={tab === 'quotes'}       onClick={() => setTab('quotes')}>Quotes</TabButton>
          <TabButton active={tab === 'deal_number'}  onClick={() => setTab('deal_number')}>
            Deal Number
            {isSalesAdmin && <PendingBadge />}
          </TabButton>
          <TabButton active={tab === 'move_request'} onClick={() => setTab('move_request')}>
            Move Request
          </TabButton>
        </nav>
      </header>

      {/* Tab content */}
      <main className="max-w-7xl mx-auto">
        {tab === 'quotes' && (
          <QuotesTab currentUserId={user?.id} isSalesAdmin={isSalesAdmin} />
        )}
        {tab === 'deal_number' && (
          <DealNumberTab currentUserId={user?.id} isSalesAdmin={isSalesAdmin} />
        )}
        {tab === 'move_request' && (
          <MoveRequestTab currentUserId={user?.id} isSalesAdmin={isSalesAdmin} />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 font-semibold transition-colors border-b-2 ${
        active
          ? 'text-orange-400 border-orange-500'
          : 'text-gray-400 border-transparent hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Red badge showing count of pending deal-number requests.
 * Only rendered for sales_admin / manager / admin users.
 */
function PendingBadge() {
  const [count, setCount] = useState(null);

  // Lazy-load from the view; refresh on mount only (cheap)
  useState(() => {
    (async () => {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('v_pending_deal_number_requests')
        .select('id', { count: 'exact', head: true });
      setCount(data?.length ?? 0);
    })();
  });

  if (!count) return null;
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">
      {count}
    </span>
  );
}
