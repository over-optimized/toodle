// T026: Integration Test - Grocery List with Completion Flow
// CRITICAL: This test MUST FAIL before implementation
// Tests complete grocery list workflow with item checking and history tracking

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('Grocery List Management Integration', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)

    const testEmail = `grocery-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for grocery list integration test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id
  })

  describe('Complete Grocery Shopping Workflow', () => {
    it('should handle full grocery shopping trip from creation to completion', async () => {
      // Step 1: Create grocery list
      const createListResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Weekly Groceries'
        })
      })

      expect(createListResponse.status).toBe(201)
      const createdList = await createListResponse.json()
      const list = Array.isArray(createdList) ? createdList[0] : createdList
      const listId = list.id

      expect(list.type).toBe('grocery')
      expect(list.title).toBe('Weekly Groceries')

      // Step 2: Add grocery items organized by category (typical shopping list)
      const groceryItems = [
        // Produce
        { content: 'Bananas', sort_order: 1 },
        { content: 'Apples', sort_order: 2 },
        { content: 'Spinach', sort_order: 3 },
        { content: 'Tomatoes', sort_order: 4 },

        // Dairy
        { content: 'Milk', sort_order: 5 },
        { content: 'Greek yogurt', sort_order: 6 },
        { content: 'Cheese slices', sort_order: 7 },

        // Pantry
        { content: 'Bread', sort_order: 8 },
        { content: 'Rice', sort_order: 9 },
        { content: 'Olive oil', sort_order: 10 },

        // Protein
        { content: 'Chicken breast', sort_order: 11 },
        { content: 'Eggs', sort_order: 12 }
      ]

      const createdItems = []
      for (const item of groceryItems) {
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
        expect(itemData.is_completed).toBe(false)
        expect(itemData.target_date).toBeNull() // Grocery lists don't have target dates
      }

      // Step 3: Simulate shopping trip - mark items as found in order
      const shoppingOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // All items
      const startShopping = Date.now()

      for (let i = 0; i < shoppingOrder.length; i++) {
        const itemIndex = shoppingOrder[i]
        const itemId = createdItems[itemIndex].id

        // Simulate time between finding items
        await new Promise(resolve => setTimeout(resolve, 10))

        const completeResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemId}`, {
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

        expect(completeResponse.status).toBe(200)
        const completedItem = await completeResponse.json()
        const itemData = Array.isArray(completedItem) ? completedItem[0] : completedItem
        expect(itemData.is_completed).toBe(true)

        // Check shopping progress
        const progressResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        const progressList = await progressResponse.json()
        const completedCount = progressList.items.filter((item: any) => item.is_completed).length
        const totalCount = progressList.items.length
        const progressPercent = (completedCount / totalCount) * 100

        expect(completedCount).toBe(i + 1)
        expect(progressPercent).toBe((i + 1) / totalCount * 100)
      }

      const endShopping = Date.now()
      const shoppingDuration = endShopping - startShopping

      // Step 4: Verify all items completed
      const finalCheckResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const finalList = await finalCheckResponse.json()
      const allCompleted = finalList.items.every((item: any) => item.is_completed)
      expect(allCompleted).toBe(true)
      expect(finalList.items).toHaveLength(groceryItems.length)

      // Step 5: Check item history was created for completed items
      const historyResponse = await fetch(`${supabaseUrl}/rest/v1/item_history?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(historyResponse.status).toBe(200)
      const historyData = await historyResponse.json()

      // Should have history entries for all completed items
      expect(historyData.length).toBeGreaterThan(0)
      expect(historyData.length).toBeLessThanOrEqual(groceryItems.length)

      // Verify history contains expected items
      const historyContents = historyData.map((h: any) => h.content)
      expect(historyContents).toContain('milk') // Normalized to lowercase
      expect(historyContents).toContain('bananas')
      expect(historyContents).toContain('chicken breast')

      // Step 6: Performance check
      expect(shoppingDuration).toBeLessThan(5000) // Should complete quickly
    })

    it('should handle partial shopping trips and resumption', async () => {
      // Create grocery list
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Partial Shopping Trip'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add items
      const items = [
        { content: 'Carrots', sort_order: 1 },
        { content: 'Potatoes', sort_order: 2 },
        { content: 'Onions', sort_order: 3 },
        { content: 'Garlic', sort_order: 4 },
        { content: 'Bell peppers', sort_order: 5 }
      ]

      const createdItems = []
      for (const item of items) {
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

        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem
        createdItems.push(itemData)
      }

      // Complete first 3 items (partial shopping)
      for (let i = 0; i < 3; i++) {
        const completeResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${createdItems[i].id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            is_completed: true
          })
        })

        expect(completeResponse.status).toBe(200)
      }

      // Check partial completion status
      const partialCheckResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const partialList = await partialCheckResponse.json()
      const completedItems = partialList.items.filter((item: any) => item.is_completed)
      const remainingItems = partialList.items.filter((item: any) => !item.is_completed)

      expect(completedItems).toHaveLength(3)
      expect(remainingItems).toHaveLength(2)

      // Resume shopping - complete remaining items
      for (let i = 3; i < 5; i++) {
        const completeResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${createdItems[i].id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            is_completed: true
          })
        })

        expect(completeResponse.status).toBe(200)
      }

      // Verify all items now completed
      const finalResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const finalList = await finalResponse.json()
      const allCompleted = finalList.items.every((item: any) => item.is_completed)
      expect(allCompleted).toBe(true)
    })
  })

  describe('Grocery List Specific Features', () => {
    it('should handle item quantity and units appropriately', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Quantity Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add items with quantities in content
      const itemsWithQuantities = [
        { content: '2 lbs Ground beef', sort_order: 1 },
        { content: '1 gallon Milk', sort_order: 2 },
        { content: '6 Bagels', sort_order: 3 },
        { content: '3 bunches Bananas', sort_order: 4 },
        { content: '500g Pasta', sort_order: 5 }
      ]

      for (const item of itemsWithQuantities) {
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
        expect(itemData.content).toBe(item.content)
      }

      // Complete items and verify history normalization
      const listWithItemsResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const listWithItems = await listWithItemsResponse.json()
      expect(listWithItems.items).toHaveLength(5)

      // Complete first item and check history
      const firstItemId = listWithItems.items[0].id
      await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${firstItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          is_completed: true
        })
      })

      // Check that history was created with normalized content
      const historyResponse = await fetch(`${supabaseUrl}/rest/v1/item_history?list_id=eq.${listId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const historyData = await historyResponse.json()
      expect(historyData.length).toBeGreaterThan(0)

      // Content should be normalized (lowercase, trimmed)
      const normalizedContent = historyData[0].content
      expect(normalizedContent).toBe('2 lbs ground beef')
      expect(historyData[0].frequency_count).toBe(1)
    })

    it('should track shopping patterns for predictive features', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Pattern Tracking List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add and complete the same item multiple times (simulating repeat purchases)
      const repeatItem = { content: 'Milk', sort_order: 1 }

      for (let i = 0; i < 3; i++) {
        // Add item
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
            content: repeatItem.content,
            sort_order: repeatItem.sort_order
          })
        })

        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem

        // Complete item
        await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemData.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            is_completed: true
          })
        })

        // Delete completed item to simulate clearing list
        await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemData.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })
      }

      // Check that history tracked frequency
      const historyResponse = await fetch(`${supabaseUrl}/rest/v1/item_history?list_id=eq.${listId}&content=eq.milk`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const historyData = await historyResponse.json()
      expect(historyData).toHaveLength(1) // Should be one record with updated frequency

      const milkHistory = historyData[0]
      expect(milkHistory.content).toBe('milk')
      expect(milkHistory.frequency_count).toBe(3)
      expect(new Date(milkHistory.last_used_at)).toBeInstanceOf(Date)
    })
  })

  describe('List Management and Organization', () => {
    it('should handle grocery list reordering for shopping efficiency', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Store Layout Optimization'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add items in random order
      const randomOrderItems = [
        { content: 'Frozen peas', sort_order: 1 }, // Frozen section
        { content: 'Bananas', sort_order: 2 }, // Produce
        { content: 'Ice cream', sort_order: 3 }, // Frozen section
        { content: 'Apples', sort_order: 4 }, // Produce
        { content: 'Milk', sort_order: 5 }, // Dairy
        { content: 'Yogurt', sort_order: 6 } // Dairy
      ]

      const createdItems = []
      for (const item of randomOrderItems) {
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

        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem
        createdItems.push(itemData)
      }

      // Reorder items by store section for efficient shopping
      const storeOptimizedOrder = [
        { id: createdItems[1].id, sort_order: 1 }, // Bananas (Produce)
        { id: createdItems[3].id, sort_order: 2 }, // Apples (Produce)
        { id: createdItems[4].id, sort_order: 3 }, // Milk (Dairy)
        { id: createdItems[5].id, sort_order: 4 }, // Yogurt (Dairy)
        { id: createdItems[0].id, sort_order: 5 }, // Frozen peas (Frozen)
        { id: createdItems[2].id, sort_order: 6 }  // Ice cream (Frozen)
      ]

      // Update sort orders
      for (const reorder of storeOptimizedOrder) {
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${reorder.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            sort_order: reorder.sort_order
          })
        })

        expect(updateResponse.status).toBe(200)
      }

      // Verify new order
      const reorderedResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*).order(sort_order)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const reorderedList = await reorderedResponse.json()
      const orderedItems = reorderedList.items

      expect(orderedItems[0].content).toBe('Bananas')
      expect(orderedItems[1].content).toBe('Apples')
      expect(orderedItems[2].content).toBe('Milk')
      expect(orderedItems[3].content).toBe('Yogurt')
      expect(orderedItems[4].content).toBe('Frozen peas')
      expect(orderedItems[5].content).toBe('Ice cream')
    })

    it('should handle large grocery lists efficiently', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Large Shopping Trip'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Create a large grocery list (75 items - near the 100 limit)
      const largeGroceryList = Array.from({ length: 75 }, (_, i) => ({
        content: `Grocery item ${i + 1}`,
        sort_order: i + 1
      }))

      // Add items in batches for performance
      const batchSize = 10
      const batches = []
      for (let i = 0; i < largeGroceryList.length; i += batchSize) {
        batches.push(largeGroceryList.slice(i, i + batchSize))
      }

      const startTime = Date.now()

      for (const batch of batches) {
        const batchPromises = batch.map(item =>
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

        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(result => {
          expect(result.status).toBe(201)
        })
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Verify all items created
      const fullListResponse = await fetch(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const fullList = await fullListResponse.json()
      expect(fullList.items).toHaveLength(75)

      // Performance check
      expect(totalTime).toBeLessThan(10000) // 10 seconds max
      const avgTimePerItem = totalTime / 75
      expect(avgTimePerItem).toBeLessThan(100) // 100ms per item max
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid grocery list operations', async () => {
      const listResponse = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Error Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Try to add item with target_date (invalid for grocery lists)
      const invalidItemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Invalid grocery item',
          target_date: new Date().toISOString(), // Should be rejected
          sort_order: 1
        })
      })

      expect(invalidItemResponse.status).toBe(400)

      // Try to exceed item limit
      // This would be tested by adding 100+ items, but we'll simulate
      // Add a valid item to ensure list works correctly
      const validItemResponse = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Valid grocery item',
          sort_order: 1
        })
      })

      expect(validItemResponse.status).toBe(201)
    })
  })
})