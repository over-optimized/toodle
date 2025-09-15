// T016: Contract Test - GET /lists endpoint
// CRITICAL: This test MUST FAIL before implementation
// Tests the API contract for retrieving user lists

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

describe('GET /lists API Contract', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string

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
  })

  describe('Response Schema Validation', () => {
    it('should return array of lists with correct schema', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('application/json')

      const lists = await response.json()
      expect(Array.isArray(lists)).toBe(true)

      // If lists exist, validate schema
      if (lists.length > 0) {
        const list = lists[0]
        expect(list).toHaveProperty('id')
        expect(list).toHaveProperty('user_id')
        expect(list).toHaveProperty('type')
        expect(list).toHaveProperty('title')
        expect(list).toHaveProperty('is_private')
        expect(list).toHaveProperty('created_at')
        expect(list).toHaveProperty('updated_at')

        // Validate field types and constraints
        expect(typeof list.id).toBe('string')
        expect(typeof list.user_id).toBe('string')
        expect(['simple', 'grocery', 'countdown']).toContain(list.type)
        expect(typeof list.title).toBe('string')
        expect(list.title.length).toBeGreaterThan(0)
        expect(list.title.length).toBeLessThanOrEqual(100)
        expect(typeof list.is_private).toBe('boolean')
        expect(new Date(list.created_at).toString()).not.toBe('Invalid Date')
        expect(new Date(list.updated_at).toString()).not.toBe('Invalid Date')
      }
    })

    it('should include shared lists with proper access control', async () => {
      // This test will be implemented once sharing is implemented
      // For now, just verify that the endpoint doesn't fail
      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
    })
  })

  describe('Authentication Requirements', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })

    it('should return 401 for invalid auth token', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Performance Requirements', () => {
    it('should respond within 500ms for typical request', async () => {
      const startTime = Date.now()

      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
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

  describe('Data Isolation', () => {
    it('should only return lists owned by or shared with authenticated user', async () => {
      const response = await fetch(`${supabaseUrl}/rest/v1/lists`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      expect(response.status).toBe(200)
      const lists = await response.json()

      // All returned lists should either be owned by user or shared with user
      for (const list of lists) {
        // For owned lists, user_id should match
        // For shared lists, there should be a valid share record
        // This validation will be more specific once implementation exists
        expect(typeof list.user_id).toBe('string')
      }
    })
  })
})