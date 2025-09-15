// T019: Contract Test - POST /lists/{id}/items endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for creating new items in lists

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('POST /lists/{id}/items API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let testListId: string
  let countdownListId: string

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
    }
  })

  describe('Valid Item Creation', () => {
    it('should create a simple item with required fields', async () => {
      const itemData = {
        content: 'Buy groceries',
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('content-type')).toContain('application/json')

      const createdItem = await response.json()

      // Validate response schema
      expect(createdItem).toHaveProperty('id')
      expect(createdItem).toHaveProperty('list_id', testListId)
      expect(createdItem).toHaveProperty('content', 'Buy groceries')
      expect(createdItem).toHaveProperty('is_completed', false) // Default
      expect(createdItem).toHaveProperty('target_date', null) // Null for simple lists
      expect(createdItem).toHaveProperty('sort_order', 1)
      expect(createdItem).toHaveProperty('created_at')
      expect(createdItem).toHaveProperty('updated_at')

      // Validate field types
      expect(typeof createdItem.id).toBe('string')
      expect(typeof createdItem.content).toBe('string')
      expect(typeof createdItem.is_completed).toBe('boolean')
      expect(typeof createdItem.sort_order).toBe('number')
      expect(new Date(createdItem.created_at).toString()).not.toBe('Invalid Date')
      expect(new Date(createdItem.updated_at).toString()).not.toBe('Invalid Date')
    })

    it('should create countdown item with target_date', async () => {
      const targetDate = new Date(Date.now() + 86400000).toISOString() // 24 hours from now
      const itemData = {
        content: 'Complete project presentation',
        target_date: targetDate,
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: countdownListId,
          ...itemData
        })
      })

      expect(response.status).toBe(201)
      const createdItem = await response.json()

      expect(createdItem.content).toBe('Complete project presentation')
      expect(createdItem.target_date).toBe(targetDate)
      expect(createdItem.list_id).toBe(countdownListId)
    })

    it('should auto-increment sort_order when not specified', async () => {
      // Create first item with explicit sort_order
      await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          content: 'First item',
          sort_order: 1
        })
      })

      // Create second item without sort_order
      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          content: 'Second item'
          // sort_order should be auto-generated
        })
      })

      expect(response.status).toBe(201)
      const createdItem = await response.json()
      expect(createdItem.sort_order).toBeGreaterThan(1)
    })

    it('should handle max length content (500 characters)', async () => {
      const maxContent = 'A'.repeat(500)
      const itemData = {
        content: maxContent,
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(201)
      const createdItem = await response.json()
      expect(createdItem.content).toBe(maxContent)
      expect(createdItem.content.length).toBe(500)
    })
  })

  describe('Input Validation', () => {
    it('should reject missing content', async () => {
      const itemData = {
        sort_order: 1
        // content missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject empty content', async () => {
      const itemData = {
        content: '',
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject content exceeding 500 characters', async () => {
      const tooLongContent = 'A'.repeat(501)
      const itemData = {
        content: tooLongContent,
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject target_date for non-countdown lists', async () => {
      const itemData = {
        content: 'Simple item with date',
        target_date: new Date().toISOString(),
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId, // Simple list
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should reject past target_date for countdown lists', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString() // 24 hours ago
      const itemData = {
        content: 'Past deadline item',
        target_date: pastDate,
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: countdownListId,
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })

    it('should require target_date for countdown lists', async () => {
      const itemData = {
        content: 'Countdown item without date',
        sort_order: 1
        // target_date missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: countdownListId,
          ...itemData
        })
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const itemData = {
        content: 'Unauthorized item',
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(401)
    })

    it('should return 403 for lists user cannot edit', async () => {
      // Create another user
      const otherEmail = `other-${Date.now()}@example.com`
      const { data: otherAuth } = await supabase.auth.signInWithOtp({
        email: otherEmail,
      })

      if (otherAuth.session) {
        const itemData = {
          content: 'Unauthorized item',
          sort_order: 1
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${otherAuth.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            ...itemData
          })
        })

        expect([403, 404]).toContain(response.status)
      }
    })

    it('should return 404 for non-existent list', async () => {
      const fakeListId = '00000000-0000-0000-0000-000000000000'
      const itemData = {
        content: 'Item for fake list',
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: fakeListId,
          ...itemData
        })
      })

      expect(response.status).toBe(404)
    })
  })

  describe('Business Rules', () => {
    it('should enforce 100 item limit per list', async () => {
      // Create 100 items
      for (let i = 0; i < 100; i++) {
        const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: testListId,
            content: `Item ${i + 1}`,
            sort_order: i + 1
          })
        })

        expect(response.status).toBe(201)
      }

      // 101st item should be rejected
      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          content: 'This should fail',
          sort_order: 101
        })
      })

      expect(response.status).toBe(403)
    })

    it('should default is_completed to false', async () => {
      const itemData = {
        content: 'Uncompleted by default',
        sort_order: 1
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          list_id: testListId,
          ...itemData
        })
      })

      expect(response.status).toBe(201)
      const createdItem = await response.json()
      expect(createdItem.is_completed).toBe(false)
    })
  })
})