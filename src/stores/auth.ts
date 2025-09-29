import { create } from 'zustand'
import { authService } from '../services/auth'

interface AuthState {
  user: { id: string; email: string } | null
  isLoading: boolean
  isAuthenticated: boolean
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
  setUser: (user: { id: string; email: string } | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signInWithMagicLink: async (email: string, redirectTo?: string) => {
    const response = await authService.signInWithMagicLink(email, redirectTo)
    return { error: response.error }
  },

  signOut: async () => {
    set({ isLoading: true })
    await authService.signOut()
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  initialize: async () => {
    set({ isLoading: true })

    const { user, error } = await authService.getSession()

    if (user && !error) {
      set({ user, isAuthenticated: true, isLoading: false })
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }

    authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        set({
          user: { id: session.user.id, email: session.user.email! },
          isAuthenticated: true
        })
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, isAuthenticated: false })
      }
    })
  },

  setUser: (user: { id: string; email: string } | null) => {
    set({ user, isAuthenticated: !!user })
  }
}))