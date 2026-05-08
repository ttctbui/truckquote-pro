import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import QuotesTab from '../components/QuotesTab';
import DealNumberTab from '../components/DealNumberTab';
import MoveRequestTab from '../components/MoveRequestTab';
import DocRequestsTab from '../components/DocRequestsTab';
import TTCHeader from '../components/TTCHeader';
import ttcLogo from '../assets/ttc-logo.png';

/**
 * Dashboard — four tabs: Quotes / Deal Number / Move Request / Doc Requests.
 * Managers get an extra link to the ETA dashboard (Phase 4).
 */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { profile, role, isSalesAdmin, isManager, loading } = useUserRole();
  const [tab, setTab] = useState('quotes');

  // Joe (f_and_i) opens straight to Doc Requests since that's his whole job
  useEffect(() => {
    if (role === 'f_and_i') setTab('doc_requests');
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-dark-muted p-8">
        Loading…
      </div>
    );
  }

  const rightNav = [
    ...(isManager ? [{ label: 'ETA Dashboard', href: '/eta-dashboard' }] : []),
    { label: 'Stats',    href: '/stats' },
    { label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <TTCHeader
        logoSrc={ttcLogo}
        appName="TruckQuote Pro"
        userName={profile?.full_name ?? user?.email}
        userRole={role}
        rightNav={rightNav}
        onSignOut={signOut}
      />

      <nav className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          <TabButton active={tab === 'quotes'} onClick={() => setTab('quotes')}>
            Quotes
          </TabButton>
          <TabButton active={tab === 'deal_number'} onClick={() => setTab('deal_number')}>
            Deal Number
            {isSalesAdmin && <PendingBadge kind="deal_number" />}
          </TabButton>
          <TabButton active={tab === 'move_request'} onClick={() => setTab('move_request')}>
            Move Request
          </TabButton>
          <TabButton active={tab === 'doc_requests'} onClick={() => setTab('doc_requests')}>
            Doc Requests
            <PendingBadge kind="doc_requests" />
          </TabButton>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto">
        {tab === 'quotes' && (
          <QuotesTab currentUserId={user?.id} isSalesAdmin={isSalesAdmin} />
        )}
        {tab === 'deal_number' && (
          <DealNumberTab
            currentUserId={user?.id}
            isSalesAdmin={isSalesAdmin}
            profile={profile}
          />
        )}
        {tab === 'move_request' && (
          <MoveRequestTab currentUserId={user?.id} isSalesAdmin={isSalesAdmin} />
        )}
        {tab === 'doc_requests' && (
          <DocRequestsTab currentUserId={user?.id} role={role} />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
        active
          ? 'text-ttc-blue border-ttc-blue dark:text-ttc-blue dark:border-ttc-blue'
          : 'text-gray-500 dark:text-dark-muted border-transparent hover:text-gray-900 dark:hover:text-dark-text'
      }`}
    >
      {children}
    </button>
  );
}

function PendingBadge({ kind }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { supabase } = await import('../lib/supabase');
      let query;
      if (kind === 'deal_number') {
        query = supabase
          .from('v_pending_deal_number_requests')
          .select('id', { count: 'exact', head: true });
      } else {
        query = supabase
          .from('doc_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
      }
      const { count: c, error } = await query;
      if (!cancelled && !error) setCount(c ?? 0);
    })();
    return () => { cancelled = true; };
  }, [kind]);

  if (!count) return null;
  return (
    <span className="ml-2 px-1.5 py-0.5 bg-stat-red text-white text-[10px] rounded-full font-bold">
      {count}
    </span>
  );
}
