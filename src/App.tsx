import { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './stores'
import { ProtectedRoute } from './components/auth'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { backgroundSync } from './lib/background-sync'
import { initializeOfflineDatabase } from './lib/offline-db'

// Lazy-loaded page components
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))
const ListViewPage = lazy(() => import('./pages/ListViewPage').then(module => ({ default: module.ListViewPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then(module => ({ default: module.AuthCallbackPage })))

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Reload page
        </button>
      </div>
    </div>
  )
}

function App() {
  const { initialize, isAuthenticated } = useAuthStore()

  useEffect(() => {
    const initializeApp = async () => {
      await initialize()
      await initializeOfflineDatabase()
      await backgroundSync.register()
    }

    initializeApp()
  }, [initialize])

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Suspense fallback={<LoadingSpinner text="Loading page..." />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
                  }
                />
                <Route
                  path="/auth/callback"
                  element={<AuthCallbackPage />}
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lists/:id"
                  element={
                    <ProtectedRoute>
                      <ListViewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="*"
                  element={<Navigate to="/" replace />}
                />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </ErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App