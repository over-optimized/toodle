// T018: Contract Test - GET /lists/{id} endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for retrieving a specific list with items

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('GET /lists/{id} API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string

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

    // Create a test list for detailed retrieval
    const testList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        type: 'simple',
        title: 'Test List for Detail View'
      })
    })

    if (testList.ok) {
      const listData = await testList.json()
      testListId = listData.id
    }
  })

  describe('Valid List Retrieval', () => {
    it('should return list with items in correct schema format', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const listWithItems = await response.json()

      // Validate list schema
      expect(listWithItems).toHaveProperty('id', testListId)
      expect(listWithItems).toHaveProperty('user_id', userId)
      expect(listWithItems).toHaveProperty('type', 'simple')
      expect(listWithItems).toHaveProperty('title', 'Test List for Detail View')
      expect(listWithItems).toHaveProperty('is_private', true)
      expect(listWithItems).toHaveProperty('created_at')
      expect(listWithItems).toHaveProperty('updated_at')
      expect(listWithItems).toHaveProperty('items')

      // Validate items array schema
      expect(Array.isArray(listWithItems.items)).toBe(true)

      // If items exist, validate item schema
      if (listWithItems.items.length > 0) {
        const item = listWithItems.items[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('list_id', testListId)
        expect(item).toHaveProperty('content')
        expect(item).toHaveProperty('is_completed')
        expect(item).toHaveProperty('sort_order')
        expect(item).toHaveProperty('created_at')
        expect(item).toHaveProperty('updated_at')

        // Validate field types
        expect(typeof item.id).toBe('string')
        expect(typeof item.content).toBe('string')
        expect(typeof item.is_completed).toBe('boolean')
        expect(typeof item.sort_order).toBe('number')
      }
    })

    it('should return items sorted by sort_order', async () => {
      // First add some items with specific sort orders
      const items = [
        { content: 'Third item', sort_order: 3 },
        { content: 'First item', sort_order: 1 },
        { content: 'Second item', sort_order: 2 }
      ]

      for (const item of items) {
        await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            ...item
          })
        })
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}?select=*,items(*).order(sort_order)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
      const listWithItems = await response.json()

      expect(listWithItems.items).toHaveLength(3)
      expect(listWithItems.items[0].content).toBe('First item')
      expect(listWithItems.items[1].content).toBe('Second item')
      expect(listWithItems.items[2].content).toBe('Third item')
    })

    it('should include countdown target_date for countdown lists', async () => {
      // Create a countdown list
      const countdownList = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          type: 'countdown',
          title: 'Countdown Test List'
        })
      })

      const countdownData = await countdownList.json()
      const countdownListId = countdownData.id

      // Add countdown item with target_date
      const targetDate = new Date(Date.now() + 86400000).toISOString() // 24 hours from now
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: countdownListId,
          content: 'Countdown item',
          target_date: targetDate,
          sort_order: 1
        })
      })

      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${countdownListId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
      const listWithItems = await response.json()

      expect(listWithItems.type).toBe('countdown')
      expect(listWithItems.items[0]).toHaveProperty('target_date')
      expect(listWithItems.items[0].target_date).toBe(targetDate)
    })
  })

  describe('Access Control', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for lists user does not have access to', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuth } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      if (otherAuth.session) {
        const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}`, {
          headers: {
            'Authorization': `Bearer ${otherAuth.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        })

        expect([403, 404]).toContain(response.status) // 403 or 404 depending on RLS implementation
      }
    })

    it('should return 404 for non-existent list ID', async () => {
      const fakeListId = '00000000-0000-0000-0000-000000000000'

      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${fakeListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(404)
    })

    it('should return 400 for invalid UUID format', async () => {
      const invalidId = 'not-a-valid-uuid'

      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${invalidId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms for list with items', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      expect(response.status).toBe(200)
      expect(responseTime).toBeLessThan(500)
    })
  })

  describe('Shared List Access', () => {
    it('should allow access to shared lists with valid share', async () => {
      // This test will be implemented once sharing functionality exists
      // For now, just verify the endpoint structure
      const response = await fetch(`${supabaseUrl}/rest/v1/lists/${testListId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
    })
  })
})