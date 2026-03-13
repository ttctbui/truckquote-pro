import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const { profile, signOut } = useAuth()
  const [commissionRate, setCommissionRate] = useState('25')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'global')
      .single()
    if (data) setCommissionRate(String(data.commission_rate))
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    await supabase
      .from('settings')
      .update({ commission_rate: parseFloat(commissionRate), updated_at: new Date() })
      .eq('id', 'global')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputClass = "bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
  const labelClass = "block text-gray-400 text-xs mb-1"

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm">← Back</button>
          <span className="text-gray-600">|</span>
          <span className="text-white font-semibold">Settings</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="text-gray-500 hover:text-white text-sm">Sign out</button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {!isManager && (
          <div className="mb-6 text-yellow-400 text-sm bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3">
            You need manager or admin access to change settings.
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : (
          <>
            {/* Commission Rate */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Commission Settings</h2>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className={labelClass}>Commission Rate (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionRate}
                      onChange={e => setCommissionRate(e.target.value)}
                      disabled={!isManager}
                    />
                    <span className="text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    e.g. 25 = salesperson earns 25% of gross profit
                  </p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs mb-1">Example</p>
                  <p className="text-white text-sm">$10,000 gross profit</p>
                  <p className="text-yellow-400 font-bold">
                    = ${(10000 * (parseFloat(commissionRate) || 0) / 100).toLocaleString()} commission
                  </p>
                </div>
              </div>
            </div>

            {isManager && (
              <div className="flex justify-end">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="bg-red-700 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}