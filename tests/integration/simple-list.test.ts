// T025: Integration Test - Create and Manage Simple List
// CRITICAL: This test MUST FAIL before implementation
// Tests complete simple list management workflow from creation to deletion

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('Simple List Management Integration', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)

    // Create authenticated user for testing
    const testEmail = `simplelist-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for simple list integration test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id
  })

  describe('Complete List Lifecycle', () => {
    it('should create, populate, and manage a simple todo list', async () => {
      // Step 1: Create a simple list
      const createListResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Daily Tasks'
        })
      })

      expect(createListResponse.status).toBe(201)
      const createdList = await createListResponse.json()
      const list = Array.isArray(createdList) ? createdList[0] : createdList
      const listId = list.id

      expect(list.type).toBe('simple')
      expect(list.title).toBe('Daily Tasks')
      expect(list.user_id).toBe(userId)
      expect(list.is_private).toBe(true)

      // Step 2: Add multiple items to the list
      const itemsToAdd = [
        { content: 'Review morning emails', sort_order: 1 },
        { content: 'Attend team standup', sort_order: 2 },
        { content: 'Complete project proposal', sort_order: 3 },
        { content: 'Call client about requirements', sort_order: 4 }
      ]

      const createdItems = []
      for (const item of itemsToAdd) {
        const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            list_id: listId,
            ...item
          })
        })

        expect(itemResponse.status).toBe(201)
        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem
        createdItems.push(itemData)

        expect(itemData.content).toBe(item.content)
        expect(itemData.sort_order).toBe(item.sort_order)
        expect(itemData.is_completed).toBe(false)
        expect(itemData.list_id).toBe(listId)
      }

      // Step 3: Retrieve list with all items
      const listWithItemsResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(listWithItemsResponse.status).toBe(200)
      const listWithItems = await listWithItemsResponse.json()

      expect(listWithItems.items).toHaveLength(4)
      expect(listWithItems.items[0].content).toBe('Review morning emails')
      expect(listWithItems.items[3].content).toBe('Call client about requirements')

      // Step 4: Mark some items as completed
      const firstItemId = createdItems[0].id
      const thirdItemId = createdItems[2].id

      // Complete first item
      const completeFirstResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${firstItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_completed: true
        })
      })

      expect(completeFirstResponse.status).toBe(200)
      const completedFirst = await completeFirstResponse.json()
      const firstCompleted = Array.isArray(completedFirst) ? completedFirst[0] : completedFirst
      expect(firstCompleted.is_completed).toBe(true)

      // Complete third item
      const completeThirdResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${thirdItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_completed: true
        })
      })

      expect(completeThirdResponse.status).toBe(200)

      // Step 5: Verify list progress
      const progressCheckResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const progressList = await progressCheckResponse.json()
      const completedItems = progressList.items.filter((item: any) => item.is_completed)
      const pendingItems = progressList.items.filter((item: any) => !item.is_completed)

      expect(completedItems).toHaveLength(2)
      expect(pendingItems).toHaveLength(2)

      // Step 6: Reorder items (move last item to first position)
      const lastItem = createdItems[3]
      const reorderResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${lastItem.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          sort_order: 0
        })
      })

      expect(reorderResponse.status).toBe(200)

      // Step 7: Add a new item
      const newItemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Schedule team lunch',
          sort_order: 5
        })
      })

      expect(newItemResponse.status).toBe(201)

      // Step 8: Update list title
      const updateListResponse = await fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${listId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title: 'Updated Daily Tasks'
        })
      })

      expect(updateListResponse.status).toBe(200)
      const updatedList = await updateListResponse.json()
      const updatedListData = Array.isArray(updatedList) ? updatedList[0] : updatedList
      expect(updatedListData.title).toBe('Updated Daily Tasks')

      // Step 9: Delete completed items
      for (const item of completedItems) {
        const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect(deleteResponse.status).toBe(204)
      }

      // Step 10: Verify final state
      const finalStateResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const finalList = await finalStateResponse.json()
      expect(finalList.title).toBe('Updated Daily Tasks')
      expect(finalList.items).toHaveLength(3) // 2 pending + 1 new item
    })

    it('should handle item editing and content updates', async () => {
      // Create list and item
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Editable Tasks'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      const itemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Original task description',
          sort_order: 1
        })
      })

      const item = await itemResponse.json()
      const itemData = Array.isArray(item) ? item[0] : item
      const itemId = itemData.id

      // Edit item content multiple times
      const updates = [
        'Updated task description',
        'Further refined task description',
        'Final task description with more details'
      ]

      for (const update of updates) {
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            content: update
          })
        })

        expect(updateResponse.status).toBe(200)
        const updatedItem = await updateResponse.json()
        const updatedItemData = Array.isArray(updatedItem) ? updatedItem[0] : updatedItem
        expect(updatedItemData.content).toBe(update)
      }
    })
  })

  describe('List Management Operations', () => {
    it('should handle bulk operations efficiently', async () => {
      // Create list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Bulk Operations Test'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add many items quickly
      const bulkItems = Array.from({ length: 20 }, (_, i) => ({
        content: `Bulk item ${i + 1}`,
        sort_order: i + 1
      }))

      const startTime = Date.now()

      const itemPromises = bulkItems.map(item =>
        fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: listId,
            ...item
          })
        })
      )

      const itemResponses = await Promise.all(itemPromises)
      const endTime = Date.now()

      // Verify all items created successfully
      itemResponses.forEach(response => {
        expect(response.status).toBe(201)
      })

      // Check performance
      const totalTime = endTime - startTime
      const avgTimePerItem = totalTime / bulkItems.length
      expect(avgTimePerItem).toBeLessThan(200) // 200ms per item max

      // Verify all items in list
      const listCheckResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const listWithItems = await listCheckResponse.json()
      expect(listWithItems.items).toHaveLength(20)
    })

    it('should maintain data integrity during concurrent operations', async () => {
      // Create list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Concurrent Operations Test'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Perform concurrent operations
      const concurrentOperations = [
        // Add items
        ...Array.from({ length: 5 }, (_, i) =>
          fetch(`${supabaseUrl}/rest/v1/items`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify({
              list_id: listId,
              content: `Concurrent item ${i + 1}`,
              sort_order: i + 1
            })
          })
        ),
        // Update list title
        fetch(`${supabaseUrl}/rest/v1/lists?id=eq.${listId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            title: 'Updated During Concurrent Ops'
          })
        })
      ]

      const results = await Promise.all(concurrentOperations)

      // Verify no operations failed due to conflicts
      results.forEach(result => {
        expect([200, 201]).toContain(result.status)
      })

      // Verify final state is consistent
      const finalCheckResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const finalList = await finalCheckResponse.json()
      expect(finalList.title).toBe('Updated During Concurrent Ops')
      expect(finalList.items).toHaveLength(5)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to create item without list
      const invalidItemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: '00000000-0000-0000-0000-000000000000',
          content: 'Orphan item',
          sort_order: 1
        })
      })

      expect(invalidItemResponse.status).toBe(404)

      // Try to update non-existent item
      const updateInvalidResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.00000000-0000-0000-0000-000000000000`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'This should fail'
        })
      })

      expect(updateInvalidResponse.status).toBe(404)
    })

    it('should enforce business rules consistently', async () => {
      // Create list and try to exceed item limit
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Limit Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Try to add item with invalid content
      const invalidContentResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: '', // Empty content should be rejected
          sort_order: 1
        })
      })

      expect(invalidContentResponse.status).toBe(400)

      // Try to add item with too long content
      const tooLongContentResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'A'.repeat(501), // Exceeds 500 char limit
          sort_order: 1
        })
      })

      expect(tooLongContentResponse.status).toBe(400)
    })
  })

  describe('Performance and Scale', () => {
    it('should handle list retrieval efficiently', async () => {
      // Create list with moderate number of items
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Performance Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add items
      for (let i = 0; i < 50; i++) {
        await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: listId,
            content: `Performance item ${i + 1}`,
            sort_order: i + 1
          })
        })
      }

      // Test retrieval performance
      const startTime = Date.now()

      const retrievalResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const retrievalTime = endTime - startTime

      expect(retrievalResponse.status).toBe(200)
      expect(retrievalTime).toBeLessThan(1000) // 1 second max

      const listWithItems = await retrievalResponse.json()
      expect(listWithItems.items).toHaveLength(50)
    })
  })
})