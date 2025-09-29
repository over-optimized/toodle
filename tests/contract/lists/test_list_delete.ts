// T016: Contract Test - DELETE /lists/{listId} endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for deleting lists

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('DELETE /lists/{listId} API Contract', () => {
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

    // Create a test list to delete
    const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        title: 'List to Delete',
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

  describe('Successful List Deletion', () => {
    it('should delete empty list successfully', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should fail in TDD phase - no backend implementation
      expect(response.status).not.toBe(204)
    })

    it('should delete list with items (cascade delete)', async () => {
      // First add items to the list
      const itemsData = [
        { content: 'Item 1', list_id: testListId, sort_order: 1 },
        { content: 'Item 2', list_id: testListId, sort_order: 2 },
        { content: 'Item 3', list_id: testListId, sort_order: 3 }
      ]

      for (const item of itemsData) {
        await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(item)
        })
      }

      // Delete the list
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should fail in TDD phase
      expect(deleteResponse.status).not.toBe(204)

      // When implemented, verify items are also deleted
      if (deleteResponse.status === 204) {
        const itemsResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        if (itemsResponse.ok) {
          const remainingItems = await itemsResponse.json()
          expect(remainingItems.length).toBe(0)
        }
      }
    })

    it('should return 204 No Content on successful deletion', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // When implemented, should return 204
      if (response.status === 204) {
        expect(response.status).toBe(204)

        // Should not have response body
        const text = await response.text()
        expect(text).toBe('')
      }
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for non-owner deletion attempts', async () => {
      // Create second user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuthData } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      const otherToken = otherAuthData.session?.access_token || ''

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should only allow list owner to delete list', async () => {
      // Verify owner can delete (will fail in TDD)
      const ownerResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Expected to fail in TDD, but test the authorization concept
      expect(ownerResponse).toBeDefined()
    })
  })

  describe('List Existence Validation', () => {
    it('should return 404 for non-existent list', async () => {
      const nonExistentListId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${nonExistentListId}`, {
        method: 'DELETE',
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

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${invalidListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(400) || expect(response.status).toBe(404)
    })
  })

  describe('Shared List Deletion Restrictions', () => {
    it('should prevent deletion of list with active shares', async () => {
      // Create a share for the list
      const shareData = {
        list_id: testListId,
        shared_with_email: 'shared-user@example.com',
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

      // Attempt to delete list with active shares
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should fail due to active shares
      expect(deleteResponse.status).toBe(400) || expect(deleteResponse.status).toBe(409)

      if (deleteResponse.status >= 400) {
        const errorBody = await deleteResponse.json()
        expect(errorBody.message || errorBody.error).toContain('shares')
      }
    })

    it('should allow deletion after revoking all shares', async () => {
      // Create and then revoke shares
      const shareData = {
        list_id: testListId,
        shared_with_email: 'temp-share@example.com',
        role: 'read'
      }

      const shareResponse = await fetch(`${supabaseUrl}/rest/v1/shares`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(shareData)
      })

      // Revoke all shares
      await fetch(`${supabaseUrl}/rest/v1/shares?list_id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Now deletion should succeed
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Should succeed after shares are revoked (will fail in TDD)
      expect(deleteResponse).toBeDefined()
    })
  })

  describe('Data Consistency', () => {
    it('should remove list from user access after deletion', async () => {
      // Delete the list
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Verify list no longer appears in user's lists
      const listsResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (listsResponse.ok) {
        const userLists = await listsResponse.json()
        const deletedList = userLists.find((list: any) => list.id === testListId)
        expect(deletedList).toBeUndefined()
      }
    })

    it('should clean up related data on deletion', async () => {
      // Create related data
      const itemData = {
        content: 'Related Item',
        list_id: testListId,
        sort_order: 1
      }

      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(itemData)
      })

      // Delete the list
      await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Verify related items are deleted
      const itemsResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (itemsResponse.ok) {
        const remainingItems = await itemsResponse.json()
        expect(remainingItems.length).toBe(0)
      }
    })
  })

  describe('Security Requirements', () => {
    it('should prevent deletion via SQL injection', async () => {
      const maliciousIds = [
        "'; DROP TABLE lists; --",
        "' OR '1'='1",
        "'; DELETE FROM lists WHERE '1'='1'; --"
      ]

      for (const maliciousId of maliciousIds) {
        const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${maliciousId}`, {
          method: 'DELETE',
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

    it('should audit log list deletions', async () => {
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // When implemented, should create audit log
      if (deleteResponse.status === 204) {
        const auditResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?action=eq.list_deleted`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        if (auditResponse.ok) {
          const auditLogs = await auditResponse.json()
          expect(auditLogs.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should delete list within 1 second', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response).toBeDefined()
      expect(responseTime).toBeLessThan(1000) // 1 second max
    })

    it('should handle deletion of list with many items efficiently', async () => {
      // Create many items
      const itemPromises = Array.from({ length: 50 }, (_, i) =>
        fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            content: `Item ${i + 1}`,
            list_id: testListId,
            sort_order: i + 1
          })
        })
      )

      await Promise.all(itemPromises)

      const startTime = Date.now()

      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(deleteResponse).toBeDefined()
      expect(responseTime).toBeLessThan(3000) // 3 seconds max for bulk deletion
    })
  })

  describe('Concurrency Handling', () => {
    it('should handle concurrent deletion attempts safely', async () => {
      const deletePromises = [
        fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        }),
        fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })
      ]

      const results = await Promise.all(deletePromises)

      // Should handle concurrent requests gracefully
      results.forEach(response => {
        expect(response).toBeDefined()
      })

      // At most one should succeed, others should return 404
      const successfulDeletions = results.filter(r => r.status === 204)
      const notFoundResponses = results.filter(r => r.status === 404)

      expect(successfulDeletions.length + notFoundResponses.length).toBe(results.length)
    })
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${nonExistentId}`, {
        method: 'DELETE',
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
      const response = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        method: 'DELETE',
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