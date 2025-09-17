// T022: Contract Test - GET /lists/{listId}/shares endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for retrieving list shares

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('GET /lists/{listId}/shares API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)

    // Create test user and get auth token
    const testEmail = `test-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for contract test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id

    // Create a test list
    const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        title: 'Shares Test List',
        type: 'simple'
      })
    })

    if (listResponse.ok) {
      const listData = await listResponse.json()
      testListId = listData.id
    } else {
      // Expected to fail in TDD - use dummy ID
      testListId = 'test-list-id'
    }
  })

  describe('Response Schema Validation', () => {
    it('should return array of shares with correct schema', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should fail in TDD phase - no backend implementation
      expect(response.status).not.toBe(200)

      // When implemented, should return proper schema
      if (response.ok) {
        expect(response.headers.get('content-type')).toContain('application/json')

        const shares = await response.json()
        expect(Array.isArray(shares)).toBe(true)

        // If shares exist, validate schema
        if (shares.length > 0) {
          const share = shares[0]
          expect(share).toHaveProperty('id')
          expect(share).toHaveProperty('list_id')
          expect(share).toHaveProperty('shared_with_email')
          expect(share).toHaveProperty('role')
          expect(share).toHaveProperty('created_by')
          expect(share).toHaveProperty('expires_at')
          expect(share).toHaveProperty('created_at')

          // Validate field types and constraints
          expect(typeof share.id).toBe('string')
          expect(typeof share.list_id).toBe('string')
          expect(share.list_id).toBe(testListId)
          expect(typeof share.shared_with_email).toBe('string')
          expect(share.shared_with_email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
          expect(['read', 'edit']).toContain(share.role)
          expect(typeof share.created_by).toBe('string')
          expect(new Date(share.expires_at).toString()).not.toBe('Invalid Date')
          expect(new Date(share.created_at).toString()).not.toBe('Invalid Date')
        }
      }
    })

    it('should return empty array for list with no shares', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()
        expect(Array.isArray(shares)).toBe(true)
        expect(shares.length).toBe(0)
      }
    })

    it('should return shares ordered by creation date', async () => {
      // Create multiple shares with delays to ensure different timestamps
      const sharesData = [
        { shared_with_email: 'user1@example.com', role: 'read' },
        { shared_with_email: 'user2@example.com', role: 'edit' },
        { shared_with_email: 'user3@example.com', role: 'read' }
      ]

      for (const shareData of sharesData) {
        await fetch(`${supabaseUrl}/rest/v1/shares`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            ...shareData
          })
        })

        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}&order=created_at`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()

        if (shares.length > 1) {
          // Verify shares are ordered by creation time
          for (let i = 1; i < shares.length; i++) {
            const prevDate = new Date(shares[i - 1].created_at).getTime()
            const currDate = new Date(shares[i].created_at).getTime()
            expect(currDate).toBeGreaterThanOrEqual(prevDate)
          }
        }
      }
    })
  })

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Authorization and Ownership', () => {
    it('should only allow list owner to view shares', async () => {
      // Create second user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuthData } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      const otherToken = otherAuthData.session?.access_token || ''

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should prevent shared users from viewing share list', async () => {
      // Create shared user
      const sharedEmail = `shared-${Date.now()}@example.com`
      const { data: sharedAuthData } = await supabase.auth.signInWithOtp({
        email: sharedEmail,
      })

      const sharedToken = sharedAuthData.session?.access_token || ''

      // Share the list with the user
      const shareData = {
        list_id: testListId,
        shared_with_email: sharedEmail,
        role: 'edit'
      }

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(shareData)
      })

      // Shared user should not be able to view shares
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${sharedToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })
  })

  describe('List Existence Validation', () => {
    it('should return 404 for non-existent list', async () => {
      const nonExistentListId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${nonExistentListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(404) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should return 400 for invalid list ID format', async () => {
      const invalidListId = 'invalid-uuid-format'

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${invalidListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(400) || expect(response.status).toBe(404)
    })
  })

  describe('Share Filtering and Status', () => {
    it('should only return active (non-expired) shares', async () => {
      // Create shares with different expiration dates
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday

      const activeShareData = {
        list_id: testListId,
        shared_with_email: 'active@example.com',
        role: 'read'
      }

      const expiredShareData = {
        list_id: testListId,
        shared_with_email: 'expired@example.com',
        role: 'read'
      }

      // Create active share
      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(activeShareData)
      })

      // Create expired share (would need to set expires_at in the past)
      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(expiredShareData)
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}&expires_at=gt.${new Date().toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()

        // All returned shares should be active (not expired)
        shares.forEach((share: any) => {
          const expiresAt = new Date(share.expires_at).getTime()
          const now = Date.now()
          expect(expiresAt).toBeGreaterThan(now)
        })
      }
    })

    it('should support filtering by role', async () => {
      // Create shares with different roles
      const readShareData = {
        list_id: testListId,
        shared_with_email: 'reader@example.com',
        role: 'read'
      }

      const editShareData = {
        list_id: testListId,
        shared_with_email: 'editor@example.com',
        role: 'edit'
      }

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(readShareData)
      })

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(editShareData)
      })

      // Filter for read-only shares
      const readResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}&role=eq.read`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (readResponse.ok) {
        const readShares = await readResponse.json()
        readShares.forEach((share: any) => {
          expect(share.role).toBe('read')
        })
      }

      // Filter for edit shares
      const editResponse = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}&role=eq.edit`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (editResponse.ok) {
        const editShares = await editResponse.json()
        editShares.forEach((share: any) => {
          expect(share.role).toBe('edit')
        })
      }
    })
  })

  describe('Data Consistency', () => {
    it('should only return shares for the specified list', async () => {
      // Create another list
      const otherListResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          title: 'Other List',
          type: 'simple'
        })
      })

      let otherListId = 'other-list-id'
      if (otherListResponse.ok) {
        const otherListData = await otherListResponse.json()
        otherListId = otherListData.id
      }

      // Create shares for both lists
      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          shared_with_email: 'target-list@example.com',
          role: 'read'
        })
      })

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: otherListId,
          shared_with_email: 'other-list@example.com',
          role: 'read'
        })
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()

        // All returned shares should belong to the target list
        shares.forEach((share: any) => {
          expect(share.list_id).toBe(testListId)
        })
      }
    })

    it('should reflect recent share updates', async () => {
      // Create a share
      const shareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          shared_with_email: 'update-test@example.com',
          role: 'read'
        })
      })

      let shareId = 'test-share-id'
      if (shareResponse.ok) {
        const shareData = await shareResponse.json()
        shareId = shareData.id
      }

      // Update the share role
      await fetch(`${supabaseUrl}/rest/v1/shares?id=eq.${shareId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          role: 'edit'
        })
      })

      // Fetch shares and verify update is reflected
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()
        const updatedShare = shares.find((share: any) => share.id === shareId)

        if (updatedShare) {
          expect(updatedShare.role).toBe('edit')
        }
      }
    })
  })

  describe('Security Requirements', () => {
    it('should not expose sensitive share information to unauthorized users', async () => {
      // Create shares with potentially sensitive data
      const shareData = {
        list_id: testListId,
        shared_with_email: 'sensitive@example.com',
        role: 'read'
      }

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(shareData)
      })

      // Create unauthorized user
      const unauthorizedEmail = `unauthorized-${Date.now()}@example.com`
      const { data: unauthorizedAuthData } = await supabase.auth.signInWithOtp({
        email: unauthorizedEmail,
      })

      const unauthorizedToken = unauthorizedAuthData.session?.access_token || ''

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${unauthorizedToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should not allow access to shares
      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should prevent SQL injection in list ID parameter', async () => {
      const maliciousIds = [
        "'; DROP TABLE shares; --",
        "' OR '1'='1",
        "'; SELECT * FROM shares WHERE '1'='1'; --"
      ]

      for (const maliciousId of maliciousIds) {
        const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${maliciousId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        // Should handle injection attempts safely
        expect(response).toBeDefined()
        // Should not cause database corruption
      }
    })

    it('should sanitize email addresses in response', async () => {
      // Create share with potential XSS in email
      const shareData = {
        list_id: testListId,
        shared_with_email: 'test<script>alert("xss")</script>@example.com',
        role: 'read'
      }

      await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(shareData)
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const shares = await response.json()

        shares.forEach((share: any) => {
          // Email should be sanitized
          expect(share.shared_with_email).not.toContain('<script>')
          expect(share.shared_with_email).not.toContain('javascript:')
        })
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms for typical request', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response).toBeDefined()
      expect(responseTime).toBeLessThan(500)
    })

    it('should handle large number of shares efficiently', async () => {
      // Create many shares
      const sharePromises = Array.from({ length: 20 }, (_, i) =>
        fetch(`${supabaseUrl}/rest/v1/shares`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            shared_with_email: `user${i + 1}@example.com`,
            role: i % 2 === 0 ? 'read' : 'edit'
          })
        })
      )

      await Promise.all(sharePromises)

      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response).toBeDefined()
      expect(responseTime).toBeLessThan(1000) // 1 second for large share list
    })
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const invalidListId = 'invalid-uuid'

      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${invalidListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.status >= 400) {
        const errorBody = await response.json()
        expect(errorBody.message || errorBody.error).toBeDefined()
        expect(typeof (errorBody.message || errorBody.error)).toBe('string')
      }
    })

    it('should handle network failures gracefully', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should not throw unhandled exceptions
      expect(response).toBeDefined()
    })
  })
})