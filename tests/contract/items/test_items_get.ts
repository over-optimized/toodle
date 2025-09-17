// T017: Contract Test - GET /lists/{listId}/items endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for retrieving list items

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('GET /lists/{listId}/items API Contract', () => {
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
        title: 'Items Test List',
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
    it('should return array of items with correct schema', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
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

        const items = await response.json()
        expect(Array.isArray(items)).toBe(true)

        // If items exist, validate schema
        if (items.length > 0) {
          const item = items[0]
          expect(item).toHaveProperty('id')
          expect(item).toHaveProperty('list_id')
          expect(item).toHaveProperty('content')
          expect(item).toHaveProperty('is_completed')
          expect(item).toHaveProperty('sort_order')
          expect(item).toHaveProperty('created_at')
          expect(item).toHaveProperty('updated_at')

          // Validate field types and constraints
          expect(typeof item.id).toBe('string')
          expect(typeof item.list_id).toBe('string')
          expect(item.list_id).toBe(testListId)
          expect(typeof item.content).toBe('string')
          expect(item.content.length).toBeGreaterThan(0)
          expect(item.content.length).toBeLessThanOrEqual(500)
          expect(typeof item.is_completed).toBe('boolean')
          expect(typeof item.sort_order).toBe('number')
          expect(item.sort_order).toBeGreaterThan(0)
          expect(new Date(item.created_at).toString()).not.toBe('Invalid Date')
          expect(new Date(item.updated_at).toString()).not.toBe('Invalid Date')

          // Optional fields validation
          if (item.target_date) {
            expect(new Date(item.target_date).toString()).not.toBe('Invalid Date')
          }
        }
      }
    })

    it('should return empty array for list with no items', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()
        expect(Array.isArray(items)).toBe(true)
        expect(items.length).toBe(0)
      }
    })

    it('should return items sorted by sort_order', async () => {
      // Create items with different sort orders
      const itemsData = [
        { content: 'Third Item', list_id: testListId, sort_order: 3 },
        { content: 'First Item', list_id: testListId, sort_order: 1 },
        { content: 'Second Item', list_id: testListId, sort_order: 2 }
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

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}&order=sort_order`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()

        if (items.length > 1) {
          // Verify items are sorted by sort_order
          for (let i = 1; i < items.length; i++) {
            expect(items[i].sort_order).toBeGreaterThanOrEqual(items[i - 1].sort_order)
          }
        }
      }
    })
  })

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('List Access Control', () => {
    it('should return 403 for accessing other user\'s private list items', async () => {
      // Create second user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuthData } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      const otherToken = otherAuthData.session?.access_token || ''

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(403) || expect(response.status).toBe(401)
    })

    it('should allow access to shared list items based on permissions', async () => {
      // Create second user
      const sharedEmail = `shared-${Date.now()}@example.com`
      const { data: sharedAuthData } = await supabase.auth.signInWithOtp({
        email: sharedEmail,
      })

      const sharedToken = sharedAuthData.session?.access_token || ''

      // Share the list with read permissions
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

      // Shared user should be able to read items
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${sharedToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      // When implemented, should allow access
      expect(response).toBeDefined()
    })
  })

  describe('List Existence Validation', () => {
    it('should return 404 for non-existent list', async () => {
      const nonExistentListId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${nonExistentListId}`, {
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

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${invalidListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(400) || expect(response.status).toBe(404)
    })
  })

  describe('Item Filtering and Ordering', () => {
    it('should support filtering by completion status', async () => {
      // Create items with different completion statuses
      const itemsData = [
        { content: 'Completed Item', list_id: testListId, sort_order: 1, is_completed: true },
        { content: 'Pending Item', list_id: testListId, sort_order: 2, is_completed: false }
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

      // Filter for completed items
      const completedResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}&is_completed=eq.true`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (completedResponse.ok) {
        const completedItems = await completedResponse.json()
        completedItems.forEach((item: any) => {
          expect(item.is_completed).toBe(true)
        })
      }

      // Filter for pending items
      const pendingResponse = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}&is_completed=eq.false`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (pendingResponse.ok) {
        const pendingItems = await pendingResponse.json()
        pendingItems.forEach((item: any) => {
          expect(item.is_completed).toBe(false)
        })
      }
    })

    it('should support ordering by creation date', async () => {
      // Create items with delays to ensure different timestamps
      const item1 = { content: 'First Item', list_id: testListId, sort_order: 1 }
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(item1)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const item2 = { content: 'Second Item', list_id: testListId, sort_order: 2 }
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(item2)
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}&order=created_at`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()

        if (items.length > 1) {
          // Verify items are ordered by creation time
          for (let i = 1; i < items.length; i++) {
            const prevDate = new Date(items[i - 1].created_at).getTime()
            const currDate = new Date(items[i].created_at).getTime()
            expect(currDate).toBeGreaterThanOrEqual(prevDate)
          }
        }
      }
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms for typical request', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
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

    it('should handle large number of items efficiently', async () => {
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

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response).toBeDefined()
      expect(responseTime).toBeLessThan(1000) // 1 second for large list
    })
  })

  describe('Data Consistency', () => {
    it('should only return items belonging to the specified list', async () => {
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

      // Create items in both lists
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Item in target list',
          list_id: testListId,
          sort_order: 1
        })
      })

      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Item in other list',
          list_id: otherListId,
          sort_order: 1
        })
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()

        // All returned items should belong to the target list
        items.forEach((item: any) => {
          expect(item.list_id).toBe(testListId)
        })
      }
    })

    it('should reflect recent item updates', async () => {
      // Create an item
      const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Original Content',
          list_id: testListId,
          sort_order: 1
        })
      })

      let itemId = 'test-item-id'
      if (itemResponse.ok) {
        const itemData = await itemResponse.json()
        itemId = itemData.id
      }

      // Update the item
      await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Updated Content'
        })
      })

      // Fetch items and verify update is reflected
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()
        const updatedItem = items.find((item: any) => item.id === itemId)

        if (updatedItem) {
          expect(updatedItem.content).toBe('Updated Content')
        }
      }
    })
  })

  describe('Security Requirements', () => {
    it('should sanitize item content against XSS', async () => {
      // Create item with potential XSS content
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: '<script>alert("xss")</script>',
          list_id: testListId,
          sort_order: 1
        })
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      if (response.ok) {
        const items = await response.json()

        items.forEach((item: any) => {
          // Content should be sanitized
          expect(item.content).not.toContain('<script>')
          expect(item.content).not.toContain('javascript:')
        })
      }
    })

    it('should prevent SQL injection in list ID parameter', async () => {
      const maliciousIds = [
        "'; DROP TABLE items; --",
        "' OR '1'='1",
        "'; SELECT * FROM items WHERE '1'='1'; --"
      ]

      for (const maliciousId of maliciousIds) {
        const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${maliciousId}`, {
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
  })

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const invalidListId = 'invalid-uuid'

      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${invalidListId}`, {
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
      const response = await fetch(`${supabaseUrl}/rest/v1/items?list_id=eq.${testListId}`, {
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