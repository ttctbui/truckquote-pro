import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editingQuote, setEditingQuote] = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editDealNumber, setEditDealNumber] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchQuotes() }, [])

  async function fetchQuotes() {
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    setLoading(false)
  }

  async function updateQuote(id, updates) {
    await supabase.from('quotes').update(updates).eq('id', id)
    fetchQuotes()
  }

  async function archiveQuote(id) {
    await supabase.from('quotes').update({ archived: true }).eq('id', id)
    fetchQuotes()
  }

  function openEdit(quote) {
    setEditingQuote(quote.id)
    setEditStatus(quote.status)
    setEditDealNumber(quote.deal_number || '')
  }

  async function saveEdit() {
    await updateQuote(editingQuote, {
      status: editStatus,
      deal_number: editDealNumber,
    })
    setEditingQuote(null)
  }

  const statusColors = {
    draft: 'bg-gray-700 text-gray-300',
    pending_approval: 'bg-yellow-900 text-yellow-300',
    approved: 'bg-green-900 text-green-300',
    sent: 'bg-blue-900 text-blue-300',
    won: 'bg-emerald-900 text-emerald-300',
    lost: 'bg-red-900 text-red-400',
  }

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'pending_approval', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'won', label: 'Sold' },
    { key: 'lost', label: 'Lost' },
    { key: 'archived', label: 'Archived' },
  ]

  const filteredQuotes = filter === 'archived'
    ? quotes.filter(q => q.archived)
    : filter === 'all'
    ? quotes.filter(q => !q.archived)
    : quotes.filter(q => !q.archived && q.status === filter)

  const activeQuotes = quotes.filter(q => !q.archived)

  const stats = {
    total: activeQuotes.length,
    pending: activeQuotes.filter(q => q.status === 'pending_approval').length,
    sold: activeQuotes.filter(q => q.status === 'won').length,
    lost: activeQuotes.filter(q => q.status === 'lost').length,
    closeRatio: activeQuotes.length > 0
      ? Math.round((activeQuotes.filter(q => q.status === 'won').length / activeQuotes.length) * 100)
      : 0,
  }

  const inputClass = "bg-gray-800 text-white rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold tracking-widest text-white">TTC QUOTE</span>
          <span className="ml-2 text-xs bg-red-800 text-red-200 px-2 py-0.5 rounded">BETA</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{profile?.full_name || profile?.email} · {profile?.role}</span>
          <button onClick={() => navigate('/stats')} className="text-gray-400 hover:text-white text-sm transition-colors">Stats</button>
          <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-white text-sm transition-colors">Settings</button>
          <button onClick={signOut} className="text-gray-500 hover:text-white text-sm transition-colors">Sign out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Quotes', value: stats.total },
            { label: 'Pending Approval', value: stats.pending },
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

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filter === f.key ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/quotes/new')}
            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            + New Quote
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredQuotes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No quotes found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Quote #</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Vehicle</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Deal #</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Docs</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Date</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(q => (
                  <tr key={q.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-300">{q.quote_number}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      <div>{q.customer_name || '—'}</div>
                      {q.company_name && <div className="text-xs text-gray-500">{q.company_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{q.year} {q.make} {q.model}</td>

                    {editingQuote === q.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input className={inputClass} value={editDealNumber}
                            onChange={e => setEditDealNumber(e.target.value)}
                            placeholder="Deal #" style={{width:'90px'}} />
                        </td>
                        <td className="px-4 py-3">
                          <select className={inputClass} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                            <option value="draft">Draft</option>
                            <option value="pending_approval">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="sent">Sent</option>
                            <option value="won">Sold</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${q.docs_submitted === 'Yes' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                            {q.docs_submitted === 'Yes' ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="text-green-400 hover:text-green-300 text-xs font-semibold">Save</button>
                            <button onClick={() => setEditingQuote(null)} className="text-gray-500 hover:text-white text-xs">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">{q.deal_number || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[q.status] || 'bg-gray-700 text-gray-300'}`}>
                            {q.status === 'won' ? 'Sold' : q.status === 'pending_approval' ? 'Pending' : q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${q.docs_submitted === 'Yes' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                            {q.docs_submitted === 'Yes' ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 items-center">
                            <button onClick={() => openEdit(q)} className="text-blue-400 hover:text-blue-300 text-xs font-semibold">Edit</button>
                            <button onClick={() => navigate(`/quotes/${q.id}`)} className="text-gray-400 hover:text-white text-xs">Open →</button>
                            {q.archived ? (
                              <button onClick={() => updateQuote(q.id, { archived: false })}
                                className="text-yellow-500 hover:text-yellow-300 text-xs">Restore</button>
                            ) : (
                              <button onClick={() => { if(window.confirm('Archive this quote?')) archiveQuote(q.id) }}
                                className="text-gray-600 hover:text-red-400 text-xs">Archive</button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
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