import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import TTCHeader from '../components/TTCHeader'
import ttcLogo from '../assets/ttc-logo.png'

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

  const inputClass = "bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-3 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 text-sm transition-all"
  const labelClass = "block text-gray-600 dark:text-dark-muted text-xs mb-1 font-medium"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text">
      <TTCHeader
        logoSrc={ttcLogo}
        appName="TruckQuote Pro"
        userName={profile?.full_name ?? profile?.email}
        userRole={profile?.role}
        rightNav={[
          { label: 'Dashboard', href: '/' },
        ]}
        onSignOut={signOut}
      />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">Settings</h1>

        {!isManager && (
          <div className="mb-6 text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-4 py-3">
            You need manager or admin access to change settings.
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 dark:text-dark-muted text-sm">Loading...</div>
        ) : (
          <>
            {/* Commission Rate */}
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-5 mb-4 shadow-ttc-card">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-text mb-4 uppercase tracking-wider">
                Commission Settings
              </h2>
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
                    <span className="text-gray-500 dark:text-dark-muted text-sm">%</span>
                  </div>
                  <p className="text-gray-500 dark:text-dark-muted text-xs mt-1">
                    e.g. 25 = salesperson earns 25% of gross profit
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-dark-bg rounded-xl p-3 border border-gray-200 dark:border-dark-border">
                  <p className="text-gray-500 dark:text-dark-muted text-xs mb-1">Example</p>
                  <p className="text-gray-900 dark:text-dark-text text-sm">$10,000 gross profit</p>
                  <p className="text-stat-green font-bold font-numeric">
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
                  className="bg-ttc-blue hover:bg-ttc-blue-dark text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
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
