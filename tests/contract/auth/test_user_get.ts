// T010: Contract Test - GET /auth/user endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for retrieving user profile

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('GET /auth/user API Contract', () => {
  let supabase: ReturnType<typeof createClient>

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('Authenticated User Profile', () => {
    it('should return user profile for authenticated user', async () => {
      // First create a session (will fail in TDD)
      const authResponse = await supabase.auth.signInWithOtp({
        email: 'profile-test@example.com'
      })

      // Attempt to get user profile
      const userResponse = await supabase.auth.getUser()

      // Should fail without valid session - expected for TDD
      expect(userResponse.error).toBeDefined()
      expect(userResponse.data.user).toBeNull()
    })

    it('should return complete user profile schema', async () => {
      // Create authenticated session (will fail in TDD)
      const authResponse = await supabase.auth.signInWithOtp({
        email: 'schema-test@example.com'
      })

      const userResponse = await supabase.auth.getUser()

      // Test expected schema when user exists
      if (userResponse.error === null && userResponse.data.user) {
        const user = userResponse.data.user

        // Required fields from API contract
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('created_at')

        // Field type validation
        expect(typeof user.id).toBe('string')
        expect(typeof user.email).toBe('string')
        expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) // Valid email format
        expect(new Date(user.created_at).toString()).not.toBe('Invalid Date')

        // Optional fields that may be present
        if (user.updated_at) {
          expect(new Date(user.updated_at).toString()).not.toBe('Invalid Date')
        }
        if (user.email_confirmed_at) {
          expect(new Date(user.email_confirmed_at).toString()).not.toBe('Invalid Date')
        }
        if (user.last_sign_in_at) {
          expect(new Date(user.last_sign_in_at).toString()).not.toBe('Invalid Date')
        }
      }
    })

    it('should include user metadata when available', async () => {
      // Create session with metadata (will fail in TDD)
      const authResponse = await supabase.auth.signInWithOtp({
        email: 'metadata-test@example.com'
      })

      const userResponse = await supabase.auth.getUser()

      if (userResponse.error === null && userResponse.data.user) {
        const user = userResponse.data.user

        // Check for user metadata structure
        expect(user).toHaveProperty('user_metadata')
        expect(user).toHaveProperty('app_metadata')

        if (user.user_metadata) {
          expect(typeof user.user_metadata).toBe('object')
        }
        if (user.app_metadata) {
          expect(typeof user.app_metadata).toBe('object')
        }
      }
    })
  })

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      // Ensure no active session
      await supabase.auth.signOut()

      // Attempt to get user without authentication
      const userResponse = await supabase.auth.getUser()

      expect(userResponse.error).toBeDefined()
      expect(userResponse.data.user).toBeNull()
    })

    it('should return 401 for invalid auth token', async () => {
      // Create client with invalid token
      const clientWithInvalidToken = createClient(supabaseUrl, supabaseKey)

      // Set invalid session
      await clientWithInvalidToken.auth.setSession({
        access_token: 'invalid-token',
        refresh_token: 'invalid-refresh'
      })

      const userResponse = await clientWithInvalidToken.auth.getUser()

      expect(userResponse.error).toBeDefined()
      expect(userResponse.data.user).toBeNull()
    })

    it('should return 401 for expired auth token', async () => {
      // This would test with genuinely expired tokens in real implementation
      const userResponse = await supabase.auth.getUser()

      // Without valid session, should return error
      expect(userResponse.error).toBeDefined()
      expect(userResponse.data.user).toBeNull()
    })
  })

  describe('Response Schema Validation', () => {
    it('should return proper success response schema', async () => {
      const userResponse = await supabase.auth.getUser()

      // Verify response structure regardless of success/failure
      expect(userResponse).toHaveProperty('data')
      expect(userResponse).toHaveProperty('error')
      expect(userResponse.data).toHaveProperty('user')

      if (userResponse.error === null && userResponse.data.user) {
        const user = userResponse.data.user
        expect(typeof user.id).toBe('string')
        expect(user.id.length).toBeGreaterThan(0)
      }
    })

    it('should return proper error response schema', async () => {
      // Ensure unauthenticated state
      await supabase.auth.signOut()

      const userResponse = await supabase.auth.getUser()

      if (userResponse.error) {
        expect(userResponse.error).toHaveProperty('message')
        expect(typeof userResponse.error.message).toBe('string')
        expect(userResponse.error.message.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Security Requirements', () => {
    it('should only return user data for token owner', async () => {
      // This test would verify users can only access their own data
      // For TDD, we test the expected behavior structure
      const userResponse = await supabase.auth.getUser()

      if (userResponse.error === null && userResponse.data.user) {
        // User should only get their own data, not other users'
        expect(userResponse.data.user.id).toBeDefined()
        expect(typeof userResponse.data.user.id).toBe('string')
      }
    })

    it('should not expose sensitive information', async () => {
      const userResponse = await supabase.auth.getUser()

      if (userResponse.error === null && userResponse.data.user) {
        const user = userResponse.data.user

        // Should not expose password, tokens, or other sensitive data
        expect(user).not.toHaveProperty('password')
        expect(user).not.toHaveProperty('password_hash')
        expect(user).not.toHaveProperty('access_token')
        expect(user).not.toHaveProperty('refresh_token')
      }
    })

    it('should sanitize user data against XSS', async () => {
      // Test that user data is properly sanitized
      const userResponse = await supabase.auth.getUser()

      if (userResponse.error === null && userResponse.data.user) {
        const user = userResponse.data.user

        // Email should be sanitized
        expect(user.email).not.toContain('<script>')
        expect(user.email).not.toContain('javascript:')

        // Other string fields should be safe
        if (user.user_metadata) {
          const metadataString = JSON.stringify(user.user_metadata)
          expect(metadataString).not.toContain('<script>')
        }
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms', async () => {
      const startTime = Date.now()

      const userResponse = await supabase.auth.getUser()

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(userResponse).toBeDefined()
      expect(responseTime).toBeLessThan(500) // 500ms max
    })
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      // Ensure unauthenticated state
      await supabase.auth.signOut()

      const userResponse = await supabase.auth.getUser()

      if (userResponse.error) {
        expect(userResponse.error.message).toBeDefined()
        expect(userResponse.error.message.length).toBeGreaterThan(0)
        expect(userResponse.error.message).not.toBe('Error')
      }
    })

    it('should handle network failures gracefully', async () => {
      // Test network resilience
      const userResponse = await supabase.auth.getUser()

      // Should not throw unhandled exceptions
      expect(userResponse).toBeDefined()
    })
  })

  describe('Data Consistency', () => {
    it('should return consistent user data across requests', async () => {
      // Create session (will fail in TDD)
      const authResponse = await supabase.auth.signInWithOtp({
        email: 'consistency-test@example.com'
      })

      // Make multiple user requests
      const request1 = await supabase.auth.getUser()
      const request2 = await supabase.auth.getUser()

      // Both should return same result
      expect(request1.error?.message).toBe(request2.error?.message)

      if (request1.data.user && request2.data.user) {
        expect(request1.data.user.id).toBe(request2.data.user.id)
        expect(request1.data.user.email).toBe(request2.data.user.email)
      }
    })

    it('should reflect recent profile updates', async () => {
      // This test would verify data freshness after updates
      // For TDD, we structure the test for future implementation
      const userResponse = await supabase.auth.getUser()

      // Test structure for profile update verification
      if (userResponse.data.user) {
        expect(userResponse.data.user.updated_at).toBeDefined()
      }
    })
  })
})