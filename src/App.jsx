import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewQuote from './pages/NewQuote'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import QuoteDetail from './pages/QuoteDetail'
import ETADashboard from './pages/ETADashboard'
import NotAuthorized from './pages/NotAuthorized'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center text-gray-500 dark:text-dark-muted">
      Loading...
    </div>
  )
}

/**
 * Three states:
 *  1. No user             → redirect to /login
 *  2. User but no profile → redirect to /not-authorized
 *  3. User + profile      → render the protected page
 */
function ProtectedRoute({ children }) {
  const { user, profile, loading, profileChecked } = useAuth()
  if (loading || !profileChecked) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/not-authorized" replace />
  return children
}

function AppRoutes() {
  const { user, profile, loading, profileChecked } = useAuth()
  if (loading || !profileChecked) return <LoadingScreen />

  return (
    <Routes>
      {/* Login: only accessible when not signed in */}
      <Route
        path="/login"
        element={
          user
            ? <Navigate to={profile ? '/' : '/not-authorized'} replace />
            : <Login />
        }
      />

      {/* Not Authorized: only accessible when signed in but no profile */}
      <Route
        path="/not-authorized"
        element={
          !user
            ? <Navigate to="/login" replace />
            : profile
              ? <Navigate to="/" replace />
              : <NotAuthorized />
        }
      />

      {/* Protected app routes */}
      <Route path="/"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/quotes/new"     element={<ProtectedRoute><NewQuote /></ProtectedRoute>} />
      <Route path="/quotes/:id"     element={<ProtectedRoute><QuoteDetail /></ProtectedRoute>} />
      <Route path="/stats"          element={<ProtectedRoute><Stats /></ProtectedRoute>} />
      <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/eta-dashboard"  element={<ProtectedRoute><ETADashboard /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
