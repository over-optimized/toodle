// T021: Contract Test - POST /lists/{id}/share endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for creating list shares

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('POST /lists/{id}/share API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string
  let privateListId: string

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)

    const testEmail = `test-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for contract test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id

    // Create test lists
    const publicList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        type: 'simple',
        title: 'Shareable Test List'
      })
    })

    const privateList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        type: 'grocery',
        title: 'Private Test List'
      })
    })

    if (publicList.ok && privateList.ok) {
      const publicData = await publicList.json()
      const privateData = await privateList.json()
      testListId = publicData.id
      privateListId = privateData.id
    }
  })

  describe('Valid Share Creation', () => {
    it('should create read-only share with valid email', async () => {
      const shareData = {
        shared_with_email: 'friend@example.com',
        role: 'read'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('content-type')).toContain('application/json')

      const createdShare = await response.json()
      const share = Array.isArray(createdShare) ? createdShare[0] : createdShare

      // Validate response schema
      expect(share).toHaveProperty('id')
      expect(share).toHaveProperty('list_id', testListId)
      expect(share).toHaveProperty('shared_with_email', 'friend@example.com')
      expect(share).toHaveProperty('role', 'read')
      expect(share).toHaveProperty('created_by', userId)
      expect(share).toHaveProperty('expires_at')
      expect(share).toHaveProperty('created_at')

      // Validate field types
      expect(typeof share.id).toBe('string')
      expect(new Date(share.expires_at).toString()).not.toBe('Invalid Date')
      expect(new Date(share.created_at).toString()).not.toBe('Invalid Date')

      // Validate expiration is within 24 hours
      const expiresAt = new Date(share.expires_at)
      const createdAt = new Date(share.created_at)
      const timeDiff = expiresAt.getTime() - createdAt.getTime()
      const hoursUntilExpiry = timeDiff / (1000 * 60 * 60)

      expect(hoursUntilExpiry).toBeLessThanOrEqual(24)
      expect(hoursUntilExpiry).toBeGreaterThan(0)
    })

    it('should create edit share with valid email', async () => {
      const shareData = {
        shared_with_email: 'collaborator@example.com',
        role: 'edit'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(201)
      const createdShare = await response.json()
      const share = Array.isArray(createdShare) ? createdShare[0] : createdShare

      expect(share.role).toBe('edit')
      expect(share.shared_with_email).toBe('collaborator@example.com')
    })

    it('should auto-set expiration to 24 hours if not provided', async () => {
      const shareData = {
        shared_with_email: 'autoexpire@example.com',
        role: 'read'
      }

      const beforeRequest = new Date()

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(201)
      const createdShare = await response.json()
      const share = Array.isArray(createdShare) ? createdShare[0] : createdShare

      const expiresAt = new Date(share.expires_at)
      const expectedExpiry = new Date(beforeRequest.getTime() + 24 * 60 * 60 * 1000) // 24 hours

      // Allow 1 minute tolerance for processing time
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime())
      expect(timeDiff).toBeLessThan(60000) // Less than 1 minute difference
    })

    it('should allow multiple shares for same list with different emails', async () => {
      const shareData1 = {
        shared_with_email: 'user1@example.com',
        role: 'read'
      }

      const shareData2 = {
        shared_with_email: 'user2@example.com',
        role: 'edit'
      }

      const response1 = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData1
        })
      })

      const response2 = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData2
        })
      })

      expect(response1.status).toBe(201)
      expect(response2.status).toBe(201)
    })
  })

  describe('Input Validation', () => {
    it('should reject missing shared_with_email', async () => {
      const shareData = {
        role: 'read'
        // shared_with_email missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject invalid email format', async () => {
      const shareData = {
        shared_with_email: 'not-an-email',
        role: 'read'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject missing role', async () => {
      const shareData = {
        shared_with_email: 'valid@example.com'
        // role missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject invalid role values', async () => {
      const shareData = {
        shared_with_email: 'valid@example.com',
        role: 'admin' // Invalid role
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject expiration beyond 24 hours', async () => {
      const farFutureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
      const shareData = {
        shared_with_email: 'longshare@example.com',
        role: 'read',
        expires_at: farFutureDate
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      // Should either reject or auto-correct to 24 hours
      if (response.status === 201) {
        const share = await response.json()
        const shareData = Array.isArray(share) ? share[0] : share
        const expiresAt = new Date(shareData.expires_at)
        const maxExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
        expect(expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry.getTime())
      } else {
        expect(response.status).toBe(400)
      }
    })

    it('should reject past expiration dates', async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      const shareData = {
        shared_with_email: 'pastshare@example.com',
        role: 'read',
        expires_at: pastDate
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const shareData = {
        shared_with_email: 'unauthorized@example.com',
        role: 'read'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...shareData
        })
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for non-owners attempting to share', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuth } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      if (otherAuth.session) {
        const shareData = {
          shared_with_email: 'friend@example.com',
          role: 'read'
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${otherAuth.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            created_by: otherAuth.user?.id,
            ...shareData
          })
        })

        expect([403, 404]).toContain(response.status)
      }
    })

    it('should return 404 for non-existent list', async () => {
      const fakeListId = '00000000-0000-0000-0000-000000000000'
      const shareData = {
        shared_with_email: 'friend@example.com',
        role: 'read'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: fakeListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(404)
    })

    it('should return 400 for invalid list UUID', async () => {
      const invalidListId = 'not-a-valid-uuid'
      const shareData = {
        shared_with_email: 'friend@example.com',
        role: 'read'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: invalidListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Business Rules', () => {
    it('should prevent sharing with self', async () => {
      // Get current user's email from auth
      const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (userResponse.ok) {
        const userData = await userResponse.json()
        const userEmail = userData[0]?.email

        if (userEmail) {
          const shareData = {
            shared_with_email: userEmail,
            role: 'read'
          }

          const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({
              list_id: testListId,
              created_by: userId,
              ...shareData
            })
          })

          expect(response.status).toBe(400)
        }
      }
    })

    it('should prevent duplicate shares for same email/list combination', async () => {
      const shareData = {
        shared_with_email: 'duplicate@example.com',
        role: 'read'
      }

      // Create first share
      const response1 = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect(response1.status).toBe(201)

      // Attempt duplicate share
      const response2 = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      expect([400, 409]).toContain(response2.status) // Conflict or bad request
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 300ms for share creation', async () => {
      const shareData = {
        shared_with_email: 'performance@example.com',
        role: 'read'
      }

      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          created_by: userId,
          ...shareData
        })
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(201)
      expect(responseTime).toBeLessThan(300)
    })
  })
})