// T020: Contract Test - PUT /lists/{id}/items/{itemId} endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for updating existing items

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('PUT /lists/{id}/items/{itemId} API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string
  let countdownListId: string
  let testItemId: string
  let countdownItemId: string

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
    const simpleList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        type: 'simple',
        title: 'Test Simple List'
      })
    })

    const countdownList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        type: 'countdown',
        title: 'Test Countdown List'
      })
    })

    if (simpleList.ok && countdownList.ok) {
      const simpleData = await simpleList.json()
      const countdownData = await countdownList.json()
      testListId = simpleData.id
      countdownListId = countdownData.id

      // Create test items
      const simpleItem = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          content: 'Original simple item',
          sort_order: 1
        })
      })

      const countdownItem = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: countdownListId,
          content: 'Original countdown item',
          target_date: new Date(Date.now() + 86400000).toISOString(),
          sort_order: 1
        })
      })

      if (simpleItem.ok && countdownItem.ok) {
        const simpleItemData = await simpleItem.json()
        const countdownItemData = await countdownItem.json()
        testItemId = simpleItemData.id
        countdownItemId = countdownItemData.id
      }
    }
  })

  describe('Valid Item Updates', () => {
    it('should update item content', async () => {
      const updateData = {
        content: 'Updated simple item content'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const updatedItems = await response.json()
      const updatedItem = updatedItems[0]

      expect(updatedItem).toHaveProperty('id', testItemId)
      expect(updatedItem).toHaveProperty('content', 'Updated simple item content')
      expect(updatedItem).toHaveProperty('list_id', testListId)
      expect(updatedItem).toHaveProperty('updated_at')

      // Verify updated_at changed
      expect(new Date(updatedItem.updated_at).getTime()).toBeGreaterThan(
        new Date(updatedItem.created_at).getTime()
      )
    })

    it('should toggle completion status', async () => {
      const updateData = {
        is_completed: true
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const updatedItems = await response.json()
      const updatedItem = updatedItems[0]

      expect(updatedItem.is_completed).toBe(true)

      // Toggle back to false
      const toggleResponse = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ is_completed: false })
      })

      expect(toggleResponse.status).toBe(200)
      const toggledItems = await toggleResponse.json()
      expect(toggledItems[0].is_completed).toBe(false)
    })

    it('should update sort_order for reordering', async () => {
      // Create additional item for reordering test
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          content: 'Second item',
          sort_order: 2
        })
      })

      // Move first item to position 3
      const updateData = {
        sort_order: 3
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const updatedItems = await response.json()
      expect(updatedItems[0].sort_order).toBe(3)
    })

    it('should update target_date for countdown items', async () => {
      const newTargetDate = new Date(Date.now() + 172800000).toISOString() // 48 hours from now
      const updateData = {
        target_date: newTargetDate
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${countdownItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const updatedItems = await response.json()
      expect(updatedItems[0].target_date).toBe(newTargetDate)
    })

    it('should update multiple fields simultaneously', async () => {
      const updateData = {
        content: 'Multi-field update',
        is_completed: true,
        sort_order: 5
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const updatedItems = await response.json()
      const updatedItem = updatedItems[0]

      expect(updatedItem.content).toBe('Multi-field update')
      expect(updatedItem.is_completed).toBe(true)
      expect(updatedItem.sort_order).toBe(5)
    })
  })

  describe('Input Validation', () => {
    it('should reject empty content', async () => {
      const updateData = {
        content: ''
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject content exceeding 500 characters', async () => {
      const updateData = {
        content: 'A'.repeat(501)
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject target_date for non-countdown items', async () => {
      const updateData = {
        target_date: new Date().toISOString()
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject past target_date for countdown items', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString() // 24 hours ago
      const updateData = {
        target_date: pastDate
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${countdownItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })

    it('should accept null target_date for countdown items (removes deadline)', async () => {
      const updateData = {
        target_date: null
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${countdownItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)
      const updatedItems = await response.json()
      expect(updatedItems[0].target_date).toBeNull()
    })

    it('should validate sort_order is positive integer', async () => {
      const updateData = {
        sort_order: -1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const updateData = {
        content: 'Unauthorized update'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for items user cannot edit', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuth } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      if (otherAuth.session) {
        const updateData = {
          content: 'Unauthorized update'
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${otherAuth.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(updateData)
        })

        expect([403, 404]).toContain(response.status)
      }
    })

    it('should return 404 for non-existent item', async () => {
      const fakeItemId = '00000000-0000-0000-0000-000000000000'
      const updateData = {
        content: 'Update fake item'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${fakeItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(404)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'
      const updateData = {
        content: 'Update invalid ID'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${invalidId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Item History Tracking', () => {
    it('should trigger history tracking when item is completed', async () => {
      const updateData = {
        is_completed: true
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(updateData)
      })

      expect(response.status).toBe(200)

      // Verify item history was created (this will depend on trigger implementation)
      const historyResponse = await fetch(`${supabaseUrl}/rest/v1/item_history?list_id=eq.${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(historyResponse.status).toBe(200)
      const historyData = await historyResponse.json()
      expect(historyData.length).toBeGreaterThan(0)
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 300ms for item update', async () => {
      const updateData = {
        content: 'Performance test update'
      }

      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${testItemId}`, {
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

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(300)
    })
  })
})