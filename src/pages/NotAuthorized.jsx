import { useAuth } from '../context/AuthContext'
import ttcLogo from '../assets/ttc-logo.png'

/**
 * Shown when a user successfully authenticates via Microsoft but has no
 * row in the `profiles` table. Most likely cause: they're an Apprentice
 * Tracker user who clicked the wrong app, OR a brand-new TTC employee
 * whose profile hasn't been provisioned yet by IT.
 */
export default function NotAuthorized() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={ttcLogo}
            alt="Tom's Truck Center"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">TruckQuote Pro</h1>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl p-6 border border-gray-200 dark:border-dark-border shadow-ttc-card">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 mb-4">
              <svg className="w-6 h-6 text-amber-700 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">
              Access not configured
            </h2>

            <p className="text-sm text-gray-600 dark:text-dark-muted mb-1">
              You signed in successfully as
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-dark-text mb-4">
              {user?.email}
            </p>

            <p className="text-sm text-gray-600 dark:text-dark-muted mb-6">
              But this account doesn't have access to TruckQuote Pro yet.
              Please contact <span className="font-medium">Thinh Bui</span> to
              be added.
            </p>

            <button
              onClick={signOut}
              className="w-full bg-ttc-blue hover:bg-ttc-blue-dark text-white font-semibold py-2 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
