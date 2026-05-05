import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ttcLogo from '../assets/ttc-logo.png'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
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

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-dark-surface rounded-xl p-6 border border-gray-200 dark:border-dark-border shadow-ttc-card"
        >
          <div className="mb-4">
            <label className="block text-gray-600 dark:text-dark-muted text-sm mb-1 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-4 py-2.5 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 transition-all"
              placeholder="you@ttruck.com"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-600 dark:text-dark-muted text-sm mb-1 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text rounded-lg px-4 py-2.5 border border-gray-300 dark:border-dark-border focus:outline-none focus:border-ttc-blue focus:ring-2 focus:ring-ttc-blue/20 transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="mb-4 text-stat-red text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ttc-blue hover:bg-ttc-blue-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
