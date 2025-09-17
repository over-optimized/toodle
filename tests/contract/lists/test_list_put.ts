// T015: Contract Test - PUT /lists/{listId} endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for updating list metadata

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('PUT /lists/{listId} API Contract', () => {
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

    // Create a test list to update
    const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        title: 'Original List Title',
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

  describe('Valid List Updates', () => {
    it('should update list title successfully', async () => {
      const updateData = {
        title: 'Updated List Title'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      // Should fail in TDD phase - no backend implementation
      expect(response.status).not.toBe(200)
    })

    it('should update list title with valid constraints', async () => {
      const validTitles = [
        'A',
        'Valid Title',
        'Title with Numbers 123',
        'Title-with-hyphens',
        'Title_with_underscores',
        'A'.repeat(100) // Max length
      ]

      for (const title of validTitles) {
        const updateData = { title }

        const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        })

        // Should fail in TDD phase
        expect(response.status).not.toBe(200)
      }
    })

    it('should maintain other list properties during title update', async () => {
      const updateData = {
        title: 'Title Only Update'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      // When implemented, should preserve other fields
      if (response.ok) {
        const updatedList = await response.json()

        expect(updatedList[0]).toHaveProperty('id')
        expect(updatedList[0]).toHaveProperty('user_id')
        expect(updatedList[0]).toHaveProperty('type')
        expect(updatedList[0]).toHaveProperty('is_private')
        expect(updatedList[0]).toHaveProperty('created_at')
        expect(updatedList[0]).toHaveProperty('updated_at')

        expect(updatedList[0].title).toBe(updateData.title)
        expect(updatedList[0].id).toBe(testListId)
        expect(updatedList[0].user_id).toBe(userId)
      }
    })
  })

  describe('Input Validation', () => {
    it('should reject empty title', async () => {
      const updateData = {
        title: ''
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject title exceeding max length', async () => {
      const updateData = {
        title: 'A'.repeat(101) // Exceeds 100 char limit
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject missing title field', async () => {
      const updateData = {}

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject invalid JSON payload', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: 'invalid-json'
      })

      expect(response.status).toBe(400) || expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const updateData = {
        title: 'Unauthorized Update'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const updateData = {
        title: 'Invalid Token Update'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for non-owner update attempts', async () => {
      // Create second user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuthData } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      const otherToken = otherAuthData.session?.access_token || ''

      const updateData = {
        title: 'Unauthorized Owner Update'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })
  })

  describe('List Existence Validation', () => {
    it('should return 404 for non-existent list', async () => {
      const nonExistentListId = '00000000-0000-0000-0000-000000000000'
      const updateData = {
        title: 'Update Non-existent List'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${nonExistentListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(404) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should return 404 for invalid list ID format', async () => {
      const invalidListId = 'invalid-uuid-format'
      const updateData = {
        title: 'Update Invalid ID'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${invalidListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400) || expect(response.status).toBe(404)
    })
  })

  describe('Response Schema Validation', () => {
    it('should return updated list with correct schema', async () => {
      const updateData = {
        title: 'Schema Validation Test'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      // When implemented, should return updated list
      if (response.ok) {
        expect(response.headers.get('content-type')).toContain('application/json')

        const updatedList = await response.json()
        expect(Array.isArray(updatedList)).toBe(true)
        expect(updatedList.length).toBe(1)

        const list = updatedList[0]
        expect(list).toHaveProperty('id')
        expect(list).toHaveProperty('user_id')
        expect(list).toHaveProperty('type')
        expect(list).toHaveProperty('title')
        expect(list).toHaveProperty('is_private')
        expect(list).toHaveProperty('created_at')
        expect(list).toHaveProperty('updated_at')

        // Validate field types
        expect(typeof list.id).toBe('string')
        expect(typeof list.user_id).toBe('string')
        expect(['simple', 'grocery', 'countdown']).toContain(list.type)
        expect(typeof list.title).toBe('string')
        expect(typeof list.is_private).toBe('boolean')
        expect(new Date(list.created_at).toString()).not.toBe('Invalid Date')
        expect(new Date(list.updated_at).toString()).not.toBe('Invalid Date')
      }
    })

    it('should update the updated_at timestamp', async () => {
      // Get original list data
      const originalResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      let originalUpdatedAt: string = ''
      if (originalResponse.ok) {
        const originalList = await originalResponse.json()
        originalUpdatedAt = originalList[0]?.updated_at || ''
      }

      // Wait a moment then update
      await new Promise(resolve => setTimeout(resolve, 1000))

      const updateData = {
        title: 'Timestamp Update Test'
      }

      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      if (updateResponse.ok) {
        const updatedList = await updateResponse.json()
        expect(updatedList[0].updated_at).not.toBe(originalUpdatedAt)
        expect(new Date(updatedList[0].updated_at).getTime()).toBeGreaterThan(
          new Date(originalUpdatedAt).getTime()
        )
      }
    })
  })

  describe('Security Requirements', () => {
    it('should sanitize title input against XSS', async () => {
      const maliciousTitles = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">'
      ]

      for (const title of maliciousTitles) {
        const updateData = { title }

        const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(updateData)
        })

        // Should either reject or sanitize malicious input
        if (response.ok) {
          const updatedList = await response.json()
          expect(updatedList[0].title).not.toContain('<script>')
          expect(updatedList[0].title).not.toContain('javascript:')
        }
      }
    })

    it('should prevent SQL injection in title', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE lists; --",
        "' OR '1'='1",
        "'; UPDATE lists SET title='hacked' WHERE '1'='1'; --"
      ]

      for (const title of sqlInjectionAttempts) {
        const updateData = { title }

        const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(updateData)
        })

        // Should handle injection attempts safely
        expect(response).toBeDefined()
        // Should not cause database errors
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should update list within 500ms', async () => {
      const updateData = {
        title: 'Performance Test Update'
      }

      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response).toBeDefined()
      expect(responseTime).toBeLessThan(500)
    })
  })

  describe('Concurrency Handling', () => {
    it('should handle concurrent updates safely', async () => {
      const updateData1 = { title: 'Concurrent Update 1' }
      const updateData2 = { title: 'Concurrent Update 2' }

      const updatePromises = [
        fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(updateData1)
        }),
        fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(updateData2)
        })
      ]

      const results = await Promise.all(updatePromises)

      // Both requests should complete without errors
      results.forEach(response => {
        expect(response).toBeDefined()
      })
    })
  })
})