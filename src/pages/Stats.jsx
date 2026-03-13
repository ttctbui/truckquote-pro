import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Topbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <span className="text-gray-600">|</span>
          <span className="text-white font-semibold">Stats</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="text-gray-500 hover:text-white text-sm">Sign out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Period + Salesperson filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {['weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${period === p ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {p}
              </button>
            ))}
          </div>

          {isManager && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Salesperson:</span>
              <select
                className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
                value={selectedSalesperson}
                onChange={e => setSelectedSalesperson(e.target.value)}>
                <option value="all">All</option>
                {salespeople.map(sp => (
                  <option key={sp.id} value={sp.id}>{sp.full_name || sp.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: `${period === 'weekly' ? 'This Week' : 'This Month'} — Quotes`, value: stats.total },
            { label: 'Sold', value: stats.sold },
            { label: 'Lost', value: stats.lost },
            { label: 'Close Ratio', value: `${stats.closeRatio}%` },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className="text-3xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Gross Profit</p>
            <p className="text-3xl font-bold text-green-400">${stats.totalGross.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Commission</p>
            <p className="text-3xl font-bold text-yellow-400">${stats.totalCommission.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Avg Days to Close</p>
            <p className="text-3xl font-bold text-blue-400">
              {stats.avgTimeToClose !== null ? `${stats.avgTimeToClose}d` : '—'}
            </p>
          </div>
        </div>

        {/* Manager: salesperson breakdown */}
        {isManager && selectedSalesperson === 'all' && salespeople.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                {period === 'weekly' ? 'This Week' : 'This Month'} — By Salesperson
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Salesperson</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Quotes</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Sold</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Lost</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Close %</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Gross Profit</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Commission</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Avg Days</th>
                </tr>
              </thead>
              <tbody>
                {getSalespersonStats().map(sp => (
                  <tr key={sp.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">{sp.full_name || sp.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{sp.total}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">{sp.sold}</td>
                    <td className="px-4 py-3 text-sm text-red-400">{sp.lost}</td>
                    <td className="px-4 py-3 text-sm text-white">{sp.closeRatio}%</td>
                    <td className="px-4 py-3 text-sm text-green-400">${sp.totalGross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-yellow-400">${sp.totalCommission.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-blue-400">{sp.avgTimeToClose !== null ? `${sp.avgTimeToClose}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent quotes in period */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {period === 'weekly' ? 'This Week' : 'This Month'} — Quotes
            </h2>
          </div>
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No quotes for this period.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Quote #</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Vehicle</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Gross</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(q => (
                  <tr key={q.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-300">{q.quote_number}</td>
                    <td className="px-4 py-3 text-sm text-white">{q.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{q.year} {q.make} {q.model}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        q.status === 'won' ? 'bg-emerald-900 text-emerald-300' :
                        q.status === 'lost' ? 'bg-red-900 text-red-400' :
                        q.status === 'pending_approval' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-gray-700 text-gray-300'}`}>
                        {q.status === 'won' ? 'Sold' : q.status === 'pending_approval' ? 'Pending' : q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-400">
                      {q.gross_profit ? `$${parseFloat(q.gross_profit).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(q.created_at).toLocaleDateString()}</td>
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