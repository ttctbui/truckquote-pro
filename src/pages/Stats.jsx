import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import TTCHeader from '../components/TTCHeader'
import StatCard from '../components/StatCard'
import ttcLogo from '../assets/ttc-logo.png'

export default function Stats() {
  const { profile, signOut } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [salespeople, setSalespeople] = useState([])
  const [selectedSalesperson, setSelectedSalesperson] = useState('all')
  const [period, setPeriod] = useState('monthly')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: quotesData } = await supabase
      .from('quotes')
      .select('*, profiles(full_name, email)')
      .eq('archived', false)
      .order('created_at', { ascending: false })

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'salesperson')

    setQuotes(quotesData || [])
    setSalespeople(profilesData || [])
    setLoading(false)
  }

  function getDateRange() {
    const now = new Date()
    if (period === 'weekly') {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      return start
    } else {
      return new Date(now.getFullYear(), now.getMonth(), 1)
    }
  }

  function filterQuotes(quotesToFilter) {
    const startDate = getDateRange()
    let filtered = quotesToFilter.filter(q => new Date(q.created_at) >= startDate)
    if (!isManager) {
      filtered = filtered.filter(q => q.salesperson_id === profile?.id)
    } else if (selectedSalesperson !== 'all') {
      filtered = filtered.filter(q => q.salesperson_id === selectedSalesperson)
    }
    return filtered
  }

  function calcStats(filteredQuotes) {
    const total = filteredQuotes.length
    const sold = filteredQuotes.filter(q => q.status === 'won').length
    const lost = filteredQuotes.filter(q => q.status === 'lost').length
    const pending = filteredQuotes.filter(q => q.status === 'pending_approval').length
    const closeRatio = total > 0 ? Math.round((sold / total) * 100) : 0
    const totalGross = filteredQuotes
      .filter(q => q.status === 'won')
      .reduce((sum, q) => sum + (parseFloat(q.gross_profit) || 0), 0)
    const totalCommission = filteredQuotes
      .filter(q => q.status === 'won')
      .reduce((sum, q) => sum + (parseFloat(q.commission) || 0), 0)
    const avgTimeToClose = calcAvgTimeToClose(filteredQuotes)

    return { total, sold, lost, pending, closeRatio, totalGross, totalCommission, avgTimeToClose }
  }

  function calcAvgTimeToClose(filteredQuotes) {
    const closedQuotes = filteredQuotes.filter(q => q.status === 'won' && q.updated_at && q.created_at)
    if (closedQuotes.length === 0) return null
    const totalDays = closedQuotes.reduce((sum, q) => {
      const diff = new Date(q.updated_at) - new Date(q.created_at)
      return sum + Math.round(diff / (1000 * 60 * 60 * 24))
    }, 0)
    return Math.round(totalDays / closedQuotes.length)
  }

  const filteredQuotes = filterQuotes(quotes)
  const stats = calcStats(filteredQuotes)

  function getSalespersonStats() {
    return salespeople.map(sp => {
      const spQuotes = filterQuotes(quotes.filter(q => q.salesperson_id === sp.id))
      return { ...sp, ...calcStats(spQuotes) }
    }).sort((a, b) => b.sold - a.sold)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <TTCHeader
        logoSrc={ttcLogo}
        appName="TruckQuote Pro"
        userName={profile?.full_name ?? profile?.email}
        userRole={profile?.role}
        rightNav={[
          { label: 'Dashboard', href: '/' },
          ...(isManager ? [{ label: 'ETA Dashboard', href: '/eta-dashboard' }] : []),
          { label: 'Settings', href: '/settings' },
        ]}
        onSignOut={signOut}
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Stats</h1>

        {/* Period + Salesperson filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {['weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${
                  period === p
                    ? 'bg-ttc-blue border-ttc-blue text-white'
                    : 'bg-white dark:bg-dark-surface border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-gray-400 dark:hover:border-dark-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {isManager && (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-dark-muted text-sm">Salesperson:</span>
              <select
                className="bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all"
                value={selectedSalesperson}
                onChange={e => setSelectedSalesperson(e.target.value)}
              >
                <option value="all">All</option>
                {salespeople.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.full_name || sp.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Top stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <StatCard
            label={`${period === 'weekly' ? 'This Week' : 'This Month'} — Quotes`}
            value={stats.total}
            tone="blue"
          />
          <StatCard label="Sold" value={stats.sold} tone="green" />
          <StatCard label="Lost" value={stats.lost} tone="red" />
          <StatCard label="Close Ratio" value={`${stats.closeRatio}%`} tone="purple" />
        </div>

        {/* Money row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Gross Profit"
            value={`$${stats.totalGross.toLocaleString()}`}
            tone="green"
          />
          <StatCard
            label="Total Commission"
            value={`$${stats.totalCommission.toLocaleString()}`}
            tone="yellow"
          />
          <StatCard
            label="Avg Days to Close"
            value={stats.avgTimeToClose !== null ? `${stats.avgTimeToClose}d` : '—'}
            tone="blue"
          />
        </div>

        {/* Manager: salesperson breakdown */}
        {isManager && selectedSalesperson === 'all' && salespeople.length > 0 && (
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden shadow-ttc-card mb-6">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
                {period === 'weekly' ? 'This Week' : 'This Month'} — By Salesperson
              </h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
                <tr className="border-b border-gray-200 dark:border-dark-border">
                  <th className="text-left font-medium px-4 py-3">Salesperson</th>
                  <th className="text-left font-medium px-4 py-3">Quotes</th>
                  <th className="text-left font-medium px-4 py-3">Sold</th>
                  <th className="text-left font-medium px-4 py-3">Lost</th>
                  <th className="text-left font-medium px-4 py-3">Close %</th>
                  <th className="text-left font-medium px-4 py-3">Gross Profit</th>
                  <th className="text-left font-medium px-4 py-3">Commission</th>
                  <th className="text-left font-medium px-4 py-3">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {getSalespersonStats().map(sp => (
                  <tr
                    key={sp.id}
                    className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{sp.full_name || sp.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">{sp.total}</td>
                    <td className="px-4 py-3 text-sm text-stat-green font-semibold">{sp.sold}</td>
                    <td className="px-4 py-3 text-sm text-stat-red">{sp.lost}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{sp.closeRatio}%</td>
                    <td className="px-4 py-3 text-sm text-stat-green font-numeric">${sp.totalGross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-stat-yellow font-numeric">${sp.totalCommission.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-stat-blue">{sp.avgTimeToClose !== null ? `${sp.avgTimeToClose}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent quotes in period */}
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden shadow-ttc-card">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
              {period === 'weekly' ? 'This Week' : 'This Month'} — Quotes
            </h2>
          </div>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-dark-muted text-sm">No quotes for this period.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-dark-bg text-xs uppercase tracking-wide text-gray-500 dark:text-dark-muted">
                <tr className="border-b border-gray-200 dark:border-dark-border">
                  <th className="text-left font-medium px-4 py-3">Quote #</th>
                  <th className="text-left font-medium px-4 py-3">Customer</th>
                  <th className="text-left font-medium px-4 py-3">Vehicle</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Gross</th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(q => (
                  <tr
                    key={q.id}
                    className="border-t border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-numeric text-gray-700 dark:text-dark-text">{q.quote_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-dark-text">{q.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-dark-text">{q.year} {q.make} {q.model}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={q.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-stat-green font-numeric">
                      {q.gross_profit ? `$${parseFloat(q.gross_profit).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-dark-muted">{new Date(q.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Status pill — handles Stats.jsx's actual enum values:
 * 'won' renders as "Sold", 'pending_approval' as "Pending", others passthrough
 */
function StatusPill({ status }) {
  const styles = {
    won:              'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    sold:             'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    lost:             'bg-red-50    text-red-700   dark:bg-red-950/40   dark:text-red-300',
    pending_approval: 'bg-amber-50  text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    approved:         'bg-green-50  text-green-700 dark:bg-green-950/40 dark:text-green-300',
    sent:             'bg-blue-50   text-blue-700  dark:bg-blue-950/40  dark:text-blue-300',
    draft:            'bg-gray-100  text-gray-700  dark:bg-gray-800     dark:text-gray-300',
  }
  const cls = styles[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  const label = status === 'won' ? 'Sold' : status === 'pending_approval' ? 'Pending' : (status ?? '—')
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span>
}
