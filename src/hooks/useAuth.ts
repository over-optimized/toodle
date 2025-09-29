import { useAuthStore } from '../stores/auth'

/**
 * Hook for accessing authentication state and methods
 * Wrapper around useAuthStore for cleaner API
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const signInWithMagicLink = useAuthStore((state) => state.signInWithMagicLink)
  const signOut = useAuthStore((state) => state.signOut)
  const initialize = useAuthStore((state) => state.initialize)

  return {
    user,
    isLoading,
    isAuthenticated,
    signInWithMagicLink,
    signOut,
    initialize
  }
}