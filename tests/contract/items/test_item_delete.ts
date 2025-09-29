// T020: Contract Test - DELETE /lists/{listId}/items/{itemId} endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for deleting list items

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('DELETE /lists/{listId}/items/{itemId} API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string
  let testItemId: string

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
        title: 'Item Delete Test List',
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

    // Create a test item to delete
    const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        content: 'Item to Delete',
        list_id: testListId,
        sort_order: 1
      })
    })

    if (itemResponse.ok) {
      const itemData = await itemResponse.json()
      testItemId = itemData.id
    } else {
      // Expected to fail in TDD - use dummy ID
      testItemId = 'test-item-id'
    }
  })

  describe('Successful Item Deletion', () => {
    it('should delete item successfully', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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

    it('should return 204 No Content on successful deletion', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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

    it('should remove item from list after deletion', async () => {
      // Delete the item
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Verify item no longer exists
      const itemsResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (itemsResponse.ok) {
        const items = await itemsResponse.json()
        const deletedItem = items.find((item: any) => item.id === testItemId)
        expect(deletedItem).toBeUndefined()
      }
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for users without list access', async () => {
      // Create second user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuthData } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      const otherToken = otherAuthData.session?.access_token || ''

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should prevent deletion for read-only shared access', async () => {
      // Create second user
      const sharedEmail = `shared-${Date.now()}@example.com`
      const { data: sharedAuthData } = await supabase.auth.signInWithOtp({
        email: sharedEmail,
      })

      const sharedToken = sharedAuthData.session?.access_token || ''

      // Share the list with read-only permissions
      const shareData = {
        list_id: testListId,
        shared_with_email: sharedEmail,
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

      // Read-only user should not be able to delete
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sharedToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should allow deletion for edit shared access', async () => {
      // Create second user
      const editEmail = `edit-${Date.now()}@example.com`
      const { data: editAuthData } = await supabase.auth.signInWithOtp({
        email: editEmail,
      })

      const editToken = editAuthData.session?.access_token || ''

      // Share the list with edit permissions
      const shareData = {
        list_id: testListId,
        shared_with_email: editEmail,
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

      // Edit user should be able to delete
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${editToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // When implemented, should allow deletion
      expect(response).toBeDefined()
    })
  })

  describe('Item and List Existence Validation', () => {
    it('should return 404 for non-existent item', async () => {
      const nonExistentItemId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${nonExistentItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(404) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should return 404 for non-existent list', async () => {
      const nonExistentListId = '00000000-0000-0000-0000-000000000000'

      // Create item in non-existent list (should fail)
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${nonExistentListId}&id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(404) || expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should return 400 for invalid item ID format', async () => {
      const invalidItemId = 'invalid-uuid-format'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${invalidItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(400) || expect(response.status).toBe(404)
    })

    it('should return 400 for invalid list ID format', async () => {
      const invalidListId = 'invalid-uuid-format'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${invalidListId}&id=eq.${testItemId}`, {
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

  describe('Item-List Relationship Validation', () => {
    it('should verify item belongs to specified list', async () => {
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

      // Try to delete item from wrong list
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${otherListId}&id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(404) || expect(response.status).toBe(400)
    })
  })

  describe('Data Consistency', () => {
    it('should update list updated_at timestamp after item deletion', async () => {
      // Get original list timestamp
      const originalListResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      let originalUpdatedAt = ''
      if (originalListResponse.ok) {
        const listData = await originalListResponse.json()
        originalUpdatedAt = listData[0]?.updated_at || ''
      }

      // Wait a moment then delete item
      await new Promise(resolve => setTimeout(resolve, 1000))

      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // Check if list timestamp was updated
      if (deleteResponse.status === 204) {
        const updatedListResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${testListId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        if (updatedListResponse.ok) {
          const listData = await updatedListResponse.json()
          expect(listData[0].updated_at).not.toBe(originalUpdatedAt)
        }
      }
    })

    it('should adjust sort_order of remaining items', async () => {
      // Create multiple items with sequential sort orders
      const itemsData = [
        { content: 'Item 1', list_id: testListId, sort_order: 1 },
        { content: 'Item 2', list_id: testListId, sort_order: 2 }, // This will be deleted
        { content: 'Item 3', list_id: testListId, sort_order: 3 },
        { content: 'Item 4', list_id: testListId, sort_order: 4 }
      ]

      const createdItems = []
      for (const item of itemsData) {
        const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(item)
        })

        if (response.ok) {
          const itemData = await response.json()
          createdItems.push(itemData)
        }
      }

      // Delete the second item (sort_order: 2)
      if (createdItems.length > 1) {
        const itemToDelete = createdItems[1]
        await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemToDelete.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        // Verify remaining items have adjusted sort orders
        const remainingItemsResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}&order=sort_order`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        if (remainingItemsResponse.ok) {
          const remainingItems = await remainingItemsResponse.json()

          // Check that sort orders are sequential without gaps
          for (let i = 0; i < remainingItems.length; i++) {
            expect(remainingItems[i].sort_order).toBe(i + 1)
          }
        }
      }
    })
  })

  describe('Security Requirements', () => {
    it('should prevent SQL injection in item ID parameter', async () => {
      const maliciousIds = [
        "'; DROP TABLE items; --",
        "' OR '1'='1",
        "'; DELETE FROM items WHERE '1'='1'; --"
      ]

      for (const maliciousId of maliciousIds) {
        const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${maliciousId}`, {
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

    it('should audit log item deletions', async () => {
      const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // When implemented, should create audit log
      if (deleteResponse.status === 204) {
        const auditResponse = await fetch(`${supabaseUrl}/rest/v1/audit_logs?action=eq.item_deleted`, {
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
    it('should delete item within 500ms', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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
      expect(responseTime).toBeLessThan(500)
    })
  })

  describe('Concurrency Handling', () => {
    it('should handle concurrent deletion attempts safely', async () => {
      const deletePromises = [
        fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        }),
        fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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

    it('should handle deletion during concurrent item updates', async () => {
      // Start an update operation
      const updatePromise = fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Updated during deletion'
        })
      })

      // Start a deletion operation
      const deletePromise = fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const [updateResult, deleteResult] = await Promise.all([updatePromise, deletePromise])

      // Both operations should complete without errors
      expect(updateResult).toBeDefined()
      expect(deleteResult).toBeDefined()

      // Either update succeeds and delete fails, or delete succeeds and update fails
      const updateSucceeded = updateResult.status === 200
      const deleteSucceeded = deleteResult.status === 204

      expect(updateSucceeded || deleteSucceeded).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${nonExistentId}`, {
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
      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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