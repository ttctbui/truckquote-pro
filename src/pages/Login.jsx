import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ttcLogo from '../assets/ttc-logo.png'

export default function Login() {
  const { signIn, signInWithAzure } = useAuth()
  const [showFallback, setShowFallback] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAzureSignIn() {
    setLoading(true)
    setError('')
    const { error } = await signInWithAzure()
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success, the OAuth flow redirects away — no need to setLoading(false)
  }

  async function handlePasswordSignIn(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src={ttcLogo}
            alt="Tom's Truck Center"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">TruckQuote Pro</h1>
          <p className="text-gray-500 dark:text-dark-muted text-sm mt-1">Tom's Truck Center</p>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-6 border border-gray-200 dark:border-dark-border shadow-ttc-card">
          {/* Primary: Microsoft Sign-In */}
          <button
            onClick={handleAzureSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-dark-bg hover:bg-gray-50 dark:hover:bg-dark-surface text-gray-900 dark:text-dark-text font-medium py-3 rounded-lg border border-gray-300 dark:border-dark-border transition-colors disabled:opacity-50"
          >
            {/* Microsoft logo (4-square) */}
            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            <span>{loading ? 'Signing in...' : 'Sign in with Microsoft'}</span>
          </button>

          <p className="text-xs text-gray-500 dark:text-dark-muted text-center mt-3">
            Use your <span className="font-medium">@ttruck.com</span> account
          </p>

          {error && (
            <div className="mt-4 text-stat-red text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          {/* Fallback: email/password (collapsed by default, will be removed after SSO is verified) */}
          {!showFallback && (
            <button
              onClick={() => setShowFallback(true)}
              className="w-full text-xs text-gray-400 dark:text-dark-muted hover:text-gray-600 dark:hover:text-dark-text mt-6 text-center"
            >
              Having trouble? Use email + password
            </button>
          )}

          {showFallback && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
                <span className="text-xs text-gray-400 dark:text-dark-muted">OR (legacy)</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
              </div>

              <form onSubmit={handlePasswordSignIn}>
                <div className="mb-4">
                  <label className="block text-gray-600 dark:text-dark-muted text-sm mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-4 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 transition-all text-sm"
                    placeholder="you@ttruck.com"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-600 dark:text-dark-muted text-sm mb-1 font-medium">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-4 py-2 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 transition-all text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-surface text-gray-700 dark:text-dark-text font-medium py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? 'Signing in...' : 'Sign in with password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
