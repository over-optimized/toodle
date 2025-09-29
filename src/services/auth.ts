import { supabase } from '../lib/supabase'
import type { AuthResponse } from '../types/api'

export class AuthService {
  async signInWithMagicLink(email: string, redirectTo?: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        return { user: null, session: null, error: error.message }
      }

      return {
        user: data.user,
        session: data.session,
        error: null
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getSession(): Promise<AuthResponse> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        return { user: null, session: null, error: error.message }
      }

      return {
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email!
        } : null,
        session,
        error: null
      }
    } catch (error) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut()
      return { error: error?.message || null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }

  getCurrentUser() {
    return supabase.auth.getUser()
  }
}

export const authService = new AuthService()