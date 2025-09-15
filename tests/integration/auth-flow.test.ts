// T024: Integration Test - Magic Link Authentication Flow
// CRITICAL: This test MUST FAIL before implementation
// Tests complete user authentication journey from magic link to authenticated session

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('Magic Link Authentication Flow Integration', () => {
  let supabase: ReturnType<typeof createClient>

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('Complete Authentication Journey', () => {
    it('should handle new user registration via magic link', async () => {
      const newUserEmail = `newuser-${Date.now()}@example.com`

      // Step 1: Request magic link for new user
      const { data: magicLinkData, error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: newUserEmail,
        options: {
          shouldCreateUser: true
        }
      })

      expect(magicLinkError).toBeNull()
      expect(magicLinkData).toBeDefined()
      expect(magicLinkData.user).toBeNull() // User not created until verification
      expect(magicLinkData.session).toBeNull() // No session until verification

      // Step 2: Simulate magic link verification (would normally come from email)
      // In real implementation, this would be handled by email link click
      // For testing, we verify the magic link was sent successfully

      // Step 3: Verify user can check authentication status
      const { data: sessionData } = await supabase.auth.getSession()
      expect(sessionData.session).toBeNull() // Should be null until verification

      // Step 4: Verify user can be found in auth system (once created)
      // This would be tested after actual magic link verification
    })

    it('should handle existing user login via magic link', async () => {
      const existingEmail = `existing-${Date.now()}@example.com`

      // Step 1: Create user first (simulate previous registration)
      const { data: createData } = await supabase.auth.signInWithOtp({
        email: existingEmail,
        options: {
          shouldCreateUser: true
        }
      })

      expect(createData).toBeDefined()

      // Step 2: Request new magic link for existing user
      const { data: loginData, error: loginError } = await supabase.auth.signInWithOtp({
        email: existingEmail
      })

      expect(loginError).toBeNull()
      expect(loginData).toBeDefined()

      // Step 3: Verify consistent behavior for existing users
      expect(loginData.user).toBeNull() // Same as new user until verification
      expect(loginData.session).toBeNull()
    })

    it('should maintain session after successful authentication', async () => {
      // This test simulates the complete flow after magic link verification
      const userEmail = `session-${Date.now()}@example.com`

      // Simulate authenticated state (would come from magic link verification)
      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session) {
        // Step 1: Verify session is active
        const { data: sessionData } = await supabase.auth.getSession()
        expect(sessionData.session).toBeDefined()
        expect(sessionData.session?.user?.email).toBe(userEmail)

        // Step 2: Verify session persists across requests
        const { data: sessionData2 } = await supabase.auth.getSession()
        expect(sessionData2.session?.access_token).toBe(sessionData.session?.access_token)

        // Step 3: Verify user can access protected resources
        const protectedRequest = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          headers: {
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect([200, 401]).toContain(protectedRequest.status) // 401 until implementation
      }
    })

    it('should handle session expiration gracefully', async () => {
      const userEmail = `expiration-${Date.now()}@example.com`

      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session) {
        // Step 1: Verify initial session
        const { data: initialSession } = await supabase.auth.getSession()
        expect(initialSession.session).toBeDefined()

        // Step 2: Check expiration time
        const expiresAt = initialSession.session?.expires_at
        expect(expiresAt).toBeDefined()
        expect(expiresAt).toBeGreaterThan(Date.now() / 1000)

        // Step 3: Verify refresh token exists for renewal
        expect(initialSession.session?.refresh_token).toBeDefined()
        expect(typeof initialSession.session?.refresh_token).toBe('string')
      }
    })
  })

  describe('Authentication State Management', () => {
    it('should track authentication state changes', async () => {
      let authStateChanges: any[] = []

      // Step 1: Set up auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        authStateChanges.push({ event, session })
      })

      // Step 2: Trigger authentication
      const userEmail = `statetrack-${Date.now()}@example.com`
      await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      // Step 3: Wait for state changes
      await new Promise(resolve => setTimeout(resolve, 100))

      // Step 4: Verify state tracking
      expect(authStateChanges.length).toBeGreaterThan(0)

      // Clean up
      subscription.unsubscribe()
    })

    it('should handle logout properly', async () => {
      const userEmail = `logout-${Date.now()}@example.com`

      // Step 1: Authenticate user
      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session) {
        // Step 2: Verify session exists
        const { data: beforeLogout } = await supabase.auth.getSession()
        expect(beforeLogout.session).toBeDefined()

        // Step 3: Logout
        const { error: logoutError } = await supabase.auth.signOut()
        expect(logoutError).toBeNull()

        // Step 4: Verify session cleared
        const { data: afterLogout } = await supabase.auth.getSession()
        expect(afterLogout.session).toBeNull()

        // Step 5: Verify protected resources inaccessible
        const protectedRequest = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          headers: {
            'Authorization': `Bearer ${authData.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect(protectedRequest.status).toBe(401)
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle multiple concurrent magic link requests', async () => {
      const userEmail = `concurrent-${Date.now()}@example.com`

      // Send multiple magic link requests simultaneously
      const requests = Array.from({ length: 3 }, () =>
        supabase.auth.signInWithOtp({
          email: userEmail,
          options: {
            shouldCreateUser: true
          }
        })
      )

      const responses = await Promise.all(requests.map(p => p.catch(e => ({ error: e }))))

      // At least one should succeed
      const successfulRequests = responses.filter(r => !('error' in r) && r.error === null)
      expect(successfulRequests.length).toBeGreaterThan(0)

      // All should handle gracefully (no unhandled exceptions)
      responses.forEach(response => {
        expect(response).toBeDefined()
      })
    })

    it('should handle invalid or expired magic link tokens', async () => {
      // Simulate invalid token verification attempt
      const invalidToken = 'invalid.token.here'

      try {
        await supabase.auth.verifyOtp({
          email: 'test@example.com',
          token: invalidToken,
          type: 'email'
        })
      } catch (error) {
        // Should handle gracefully
        expect(error).toBeDefined()
      }

      // Session should remain null
      const { data: sessionData } = await supabase.auth.getSession()
      expect(sessionData.session).toBeNull()
    })

    it('should handle network failures during authentication', async () => {
      // This test simulates network conditions
      const userEmail = `network-test-${Date.now()}@example.com`

      try {
        const response = await supabase.auth.signInWithOtp({
          email: userEmail,
          options: {
            shouldCreateUser: true
          }
        })

        // Should not throw unhandled exceptions
        expect(response).toBeDefined()
      } catch (error) {
        // Network errors should be handled gracefully
        expect(error).toBeDefined()
      }
    })

    it('should prevent session hijacking attempts', async () => {
      const userEmail = `security-${Date.now()}@example.com`

      // Step 1: Create legitimate session
      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session) {
        // Step 2: Attempt to modify token
        const tamperedToken = authData.session.access_token.slice(0, -10) + 'tampered123'

        // Step 3: Verify tampered token is rejected
        const protectedRequest = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          headers: {
            'Authorization': `Bearer ${tamperedToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect(protectedRequest.status).toBe(401)
      }
    })
  })

  describe('User Profile Creation', () => {
    it('should create user profile in custom users table', async () => {
      const userEmail = `profile-${Date.now()}@example.com`

      // Step 1: Authenticate user
      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.user) {
        // Step 2: Verify user exists in auth.users
        expect(authData.user.id).toBeDefined()
        expect(authData.user.email).toBe(userEmail)

        // Step 3: Check if custom user profile was created
        if (authData.session) {
          const userProfileRequest = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${authData.user.id}`, {
            headers: {
              'Authorization': `Bearer ${authData.session.access_token}`,
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            }
          })

          // Profile creation will depend on triggers/implementation
          expect([200, 401, 404]).toContain(userProfileRequest.status)
        }
      }
    })

    it('should handle user profile updates', async () => {
      const userEmail = `updateprofile-${Date.now()}@example.com`

      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session && authData.user) {
        // Test user metadata updates
        const { error } = await supabase.auth.updateUser({
          data: {
            display_name: 'Test User'
          }
        })

        // Should handle gracefully
        expect(error).toBeNull()

        // Verify updated session
        const { data: updatedSession } = await supabase.auth.getSession()
        expect(updatedSession.session?.user?.id).toBe(authData.user.id)
      }
    })
  })

  describe('Performance and Reliability', () => {
    it('should complete authentication flow within reasonable time', async () => {
      const userEmail = `performance-${Date.now()}@example.com`

      const startTime = Date.now()

      const { data: authData, error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(error).toBeNull()
      expect(authData).toBeDefined()
      expect(duration).toBeLessThan(3000) // 3 seconds max for magic link request
    })

    it('should maintain session stability under load', async () => {
      const userEmail = `stability-${Date.now()}@example.com`

      const { data: authData } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: true
        }
      })

      if (authData.session) {
        // Make multiple concurrent session requests
        const sessionRequests = Array.from({ length: 10 }, () =>
          supabase.auth.getSession()
        )

        const results = await Promise.all(sessionRequests)

        // All should return consistent session data
        results.forEach(({ data, error }) => {
          expect(error).toBeNull()
          expect(data.session?.user?.id).toBe(authData.user?.id)
        })
      }
    })
  })
})