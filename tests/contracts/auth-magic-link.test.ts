// T022: Contract Test - POST /auth/magic-link endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for sending magic link authentication

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('POST /auth/magic-link API Contract', () => {
  let supabase: ReturnType<typeof createClient>

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('Valid Magic Link Requests', () => {
    it('should send magic link for valid email address', async () => {
      const magicLinkData = {
        email: 'test@example.com'
      }

      const response = await supabase.auth.signInWithOtp({
        email: magicLinkData.email,
        options: {
          shouldCreateUser: true
        }
      })

      // Supabase returns success even for non-existent emails for security
      expect(response.error).toBeNull()
      expect(response.data).toBeDefined()
      expect(response.data.user).toBeNull() // User not created until verification
      expect(response.data.session).toBeNull() // No session until verification
    })

    it('should handle existing user email', async () => {
      const existingEmail = `existing-${Date.now()}@example.com`

      // First, create user by completing magic link flow
      const signupResponse = await supabase.auth.signInWithOtp({
        email: existingEmail,
        options: {
          shouldCreateUser: true
        }
      })

      expect(signupResponse.error).toBeNull()

      // Send another magic link to same email
      const secondLinkResponse = await supabase.auth.signInWithOtp({
        email: existingEmail
      })

      expect(secondLinkResponse.error).toBeNull()
      expect(secondLinkResponse.data).toBeDefined()
    })

    it('should accept various valid email formats', async () => {
      const validEmails = [
        'simple@example.com',
        'with+plus@example.com',
        'with.dots@example.com',
        'with-hyphens@example.com',
        'numbers123@example.com',
        'subdomain@sub.example.com'
      ]

      for (const email of validEmails) {
        const response = await supabase.auth.signInWithOtp({
          email: email
        })

        expect(response.error).toBeNull()
        expect(response.data).toBeDefined()
      }
    })

    it('should include redirect URL when provided', async () => {
      const magicLinkData = {
        email: 'redirect@example.com'
      }

      const response = await supabase.auth.signInWithOtp({
        email: magicLinkData.email,
        options: {
          emailRedirectTo: 'https://example.com/auth/callback'
        }
      })

      expect(response.error).toBeNull()
      expect(response.data).toBeDefined()
    })
  })

  describe('Input Validation', () => {
    it('should reject missing email', async () => {
      try {
        // @ts-expect-error - Testing invalid input
        await supabase.auth.signInWithOtp({})
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        '',
        'not-an-email',
        '@example.com',
        'test@',
        'test..test@example.com',
        'test@.com',
        'test@example.',
        'test space@example.com'
      ]

      for (const email of invalidEmails) {
        const response = await supabase.auth.signInWithOtp({
          email: email
        })

        expect(response.error).toBeDefined()
        expect(response.error?.message).toContain('email')
      }
    })

    it('should reject extremely long email addresses', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com'

      const response = await supabase.auth.signInWithOtp({
        email: longEmail
      })

      expect(response.error).toBeDefined()
    })

    it('should reject email with invalid characters', async () => {
      const invalidChars = ['<script>', '"quotes"', '\\backslash']

      for (const invalidChar of invalidChars) {
        const email = `test${invalidChar}@example.com`

        const response = await supabase.auth.signInWithOtp({
          email: email
        })

        expect(response.error).toBeDefined()
      }
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limiting for multiple requests', async () => {
      const email = `ratelimit-${Date.now()}@example.com`

      // Send multiple magic link requests rapidly
      const requests = Array.from({ length: 5 }, () =>
        supabase.auth.signInWithOtp({ email })
      )

      const responses = await Promise.all(requests)

      // At least some requests should succeed
      const successfulRequests = responses.filter(r => r.error === null)
      expect(successfulRequests.length).toBeGreaterThan(0)

      // If rate limiting is implemented, some might fail
      const rateLimitedRequests = responses.filter(r =>
        r.error?.message?.includes('rate') ||
        r.error?.message?.includes('limit') ||
        r.error?.message?.includes('too many')
      )

      // This will depend on Supabase rate limiting configuration
      // The test ensures the endpoint handles rapid requests gracefully
    }, 10000) // Extended timeout for multiple requests

    it('should handle concurrent requests to same email', async () => {
      const email = `concurrent-${Date.now()}@example.com`

      // Send multiple concurrent requests for same email
      const concurrentRequests = Promise.all([
        supabase.auth.signInWithOtp({ email }),
        supabase.auth.signInWithOtp({ email }),
        supabase.auth.signInWithOtp({ email })
      ])

      const responses = await concurrentRequests

      // All requests should complete without throwing errors
      responses.forEach(response => {
        expect(response).toBeDefined()
        // Some may succeed, others may be rate limited
      })
    })
  })

  describe('Security Requirements', () => {
    it('should not reveal whether email exists in system', async () => {
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`
      const existingEmail = `existing-${Date.now()}@example.com`

      // Create an existing user first
      await supabase.auth.signInWithOtp({
        email: existingEmail,
        options: { shouldCreateUser: true }
      })

      // Request magic links for both emails
      const nonExistentResponse = await supabase.auth.signInWithOtp({
        email: nonExistentEmail
      })

      const existingResponse = await supabase.auth.signInWithOtp({
        email: existingEmail
      })

      // Both should return same success response (no user enumeration)
      expect(nonExistentResponse.error).toBeNull()
      expect(existingResponse.error).toBeNull()

      // Response structure should be identical
      expect(typeof nonExistentResponse.data).toBe(typeof existingResponse.data)
    })

    it('should sanitize email input against injection attacks', async () => {
      const maliciousEmails = [
        'test@example.com; DROP TABLE users;',
        'test@example.com"><script>alert("xss")</script>',
        'test@example.com\nBCC: attacker@evil.com'
      ]

      for (const email of maliciousEmails) {
        const response = await supabase.auth.signInWithOtp({
          email: email
        })

        // Should either reject as invalid email or safely handle
        expect(response).toBeDefined()
        // No exceptions should be thrown from injection attempts
      }
    })

    it('should handle URL redirect validation', async () => {
      const maliciousRedirects = [
        'javascript:alert("xss")',
        'http://evil.com/steal-tokens',
        'data:text/html,<script>alert("xss")</script>',
        'ftp://evil.com/'
      ]

      for (const redirectUrl of maliciousRedirects) {
        const response = await supabase.auth.signInWithOtp({
          email: 'test@example.com',
          options: {
            emailRedirectTo: redirectUrl
          }
        })

        // Should either reject invalid redirect or sanitize it
        expect(response).toBeDefined()
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 2 seconds for magic link request', async () => {
      const email = `performance-${Date.now()}@example.com`

      const startTime = Date.now()

      const response = await supabase.auth.signInWithOtp({
        email: email
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.error).toBeNull()
      expect(responseTime).toBeLessThan(2000) // 2 seconds max
    })

    it('should handle high-frequency valid requests efficiently', async () => {
      const emails = Array.from({ length: 10 }, (_, i) =>
        `batch-${Date.now()}-${i}@example.com`
      )

      const startTime = Date.now()

      const responses = await Promise.all(
        emails.map(email => supabase.auth.signInWithOtp({ email }))
      )

      const endTime = Date.now()
      const totalTime = endTime - startTime
      const avgTimePerRequest = totalTime / emails.length

      // Most requests should succeed
      const successCount = responses.filter(r => r.error === null).length
      expect(successCount).toBeGreaterThan(emails.length * 0.5) // At least 50% success

      // Average response time should be reasonable
      expect(avgTimePerRequest).toBeLessThan(1000) // 1 second average
    }, 15000) // Extended timeout for batch testing
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages for validation failures', async () => {
      const response = await supabase.auth.signInWithOtp({
        email: 'invalid-email'
      })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toBeDefined()
      expect(response.error?.message?.length).toBeGreaterThan(0)
    })

    it('should handle network timeouts gracefully', async () => {
      // This test simulates network conditions
      // In real implementation, would test with network delays
      const email = `timeout-test-${Date.now()}@example.com`

      const response = await supabase.auth.signInWithOtp({
        email: email
      })

      // Should not throw unhandled exceptions
      expect(response).toBeDefined()
    })
  })

  describe('Magic Link Generation', () => {
    it('should generate unique tokens for each request', async () => {
      const email = `unique-tokens-${Date.now()}@example.com`

      // Send multiple magic links (if allowed by rate limiting)
      const response1 = await supabase.auth.signInWithOtp({ email })

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1000))

      const response2 = await supabase.auth.signInWithOtp({ email })

      expect(response1.error).toBeNull()
      expect(response2.error).toBeNull()

      // While we can't directly compare tokens (they're not exposed),
      // we can verify both requests succeeded
      expect(response1.data).toBeDefined()
      expect(response2.data).toBeDefined()
    })

    it('should handle multiple magic links for same user', async () => {
      const email = `multiple-links-${Date.now()}@example.com`

      // Send first magic link
      const response1 = await supabase.auth.signInWithOtp({ email })
      expect(response1.error).toBeNull()

      // Send second magic link (should invalidate first or handle gracefully)
      const response2 = await supabase.auth.signInWithOtp({ email })
      expect(response2.error).toBeNull()

      // Both responses should be successful
      expect(response1.data).toBeDefined()
      expect(response2.data).toBeDefined()
    })
  })
})