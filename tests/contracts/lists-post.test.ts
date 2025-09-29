// T017: Contract Test - POST /lists endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for creating new lists

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('POST /lists API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string

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
  })

  describe('Valid Request Processing', () => {
    it('should create a simple list with valid input', async () => {
      const listData = {
        type: 'simple',
        title: 'My Test List'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(201)
      expect(response.headers.get('content-type')).toContain('application/json')

      const createdList = await response.json()

      // Validate response schema
      expect(createdList).toHaveProperty('id')
      expect(createdList).toHaveProperty('user_id', userId)
      expect(createdList).toHaveProperty('type', 'simple')
      expect(createdList).toHaveProperty('title', 'My Test List')
      expect(createdList).toHaveProperty('is_private', true) // Default
      expect(createdList).toHaveProperty('created_at')
      expect(createdList).toHaveProperty('updated_at')

      // Validate field types
      expect(typeof createdList.id).toBe('string')
      expect(new Date(createdList.created_at).toString()).not.toBe('Invalid Date')
      expect(new Date(createdList.updated_at).toString()).not.toBe('Invalid Date')
    })

    it('should create a grocery list', async () => {
      const listData = {
        type: 'grocery',
        title: 'Weekly Groceries'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(201)
      const createdList = await response.json()
      expect(createdList.type).toBe('grocery')
      expect(createdList.title).toBe('Weekly Groceries')
    })

    it('should create a countdown list', async () => {
      const listData = {
        type: 'countdown',
        title: 'Event Checklist'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(201)
      const createdList = await response.json()
      expect(createdList.type).toBe('countdown')
      expect(createdList.title).toBe('Event Checklist')
    })
  })

  describe('Input Validation', () => {
    it('should reject missing title', async () => {
      const listData = {
        type: 'simple'
        // title missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject empty title', async () => {
      const listData = {
        type: 'simple',
        title: ''
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject title exceeding 100 characters', async () => {
      const listData = {
        type: 'simple',
        title: 'A'.repeat(101) // 101 characters
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject invalid list type', async () => {
      const listData = {
        type: 'invalid-type',
        title: 'Test List'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(400)
    })

    it('should reject missing type', async () => {
      const listData = {
        title: 'Test List'
        // type missing
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(400)
    })
  })

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const listData = {
        type: 'simple',
        title: 'Test List'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const listData = {
        type: 'simple',
        title: 'Test List'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Business Rules', () => {
    it('should enforce 10 list limit per user', async () => {
      // Create 10 lists first
      for (let i = 0; i < 10; i++) {
        const listData = {
          type: 'simple',
          title: `Test List ${i + 1}`
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify(listData)
        })

        expect(response.status).toBe(201)
      }

      // 11th list should be rejected
      const listData = {
        type: 'simple',
        title: 'This should fail'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(403)
    })

    it('should default is_private to true', async () => {
      const listData = {
        type: 'simple',
        title: 'Private by default'
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(listData)
      })

      expect(response.status).toBe(201)
      const createdList = await response.json()
      expect(createdList.is_private).toBe(true)
    })
  })
})