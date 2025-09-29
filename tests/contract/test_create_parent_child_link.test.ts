import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for create_parent_child_link RPC endpoint
// This test MUST fail initially (TDD requirement)

describe('create_parent_child_link RPC Contract', () => {
  let testUserId: string
  let testListId1: string
  let testListId2: string
  let parentItemId: string
  let childItem1Id: string
  let childItem2Id: string

  beforeEach(async () => {
    // Setup test data
    testUserId = uuidv4()
    testListId1 = uuidv4()
    testListId2 = uuidv4()
    parentItemId = uuidv4()
    childItem1Id = uuidv4()
    childItem2Id = uuidv4()

    // Create test user (simplified - in real implementation would use auth)
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create test lists
    await supabase.from('lists').insert([
      {
        id: testListId1,
        user_id: testUserId,
        title: 'Meal Planning',
        type: 'simple'
      },
      {
        id: testListId2,
        user_id: testUserId,
        title: 'Grocery List',
        type: 'grocery'
      }
    ])

    // Create test items
    await supabase.from('items').insert([
      {
        id: parentItemId,
        list_id: testListId1,
        content: 'Steak Dinner',
        is_completed: false,
        position: 1
      },
      {
        id: childItem1Id,
        list_id: testListId2,
        content: 'Steak',
        is_completed: false,
        position: 1
      },
      {
        id: childItem2Id,
        list_id: testListId2,
        content: 'Potatoes',
        is_completed: true,
        position: 2
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItemId, childItem1Id, childItem2Id])
    await supabase.from('lists').delete().in('id', [testListId1, testListId2])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Request/Response Contract', () => {
    it('should accept valid parent_item_id and child_item_ids array', async () => {
      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id, childItem2Id]
      })

      // Should not throw an error for valid input structure
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should return success boolean and links_created count', async () => {
      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      expect(error).toBeNull()
      expect(data).toHaveProperty('success')
      expect(typeof data.success).toBe('boolean')
      expect(data).toHaveProperty('links_created')
      expect(typeof data.links_created).toBe('number')
    })

    it('should return warnings array for problematic inputs', async () => {
      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [parentItemId, uuidv4()] // Self-link and non-existent item
      })

      expect(error).toBeNull()
      expect(data).toHaveProperty('warnings')
      expect(Array.isArray(data.warnings)).toBe(true)
    })

    it('should reject invalid UUID format for parent_item_id', async () => {
      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: 'invalid-uuid',
        child_item_ids: [childItem1Id]
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should reject non-array child_item_ids parameter', async () => {
      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: childItem1Id // Should be array, not string
      })

      expect(error).not.toBeNull()
    })

    it('should enforce maximum 20 child items limit from API contract', async () => {
      const manyChildIds = Array(21).fill(0).map(() => uuidv4())

      const { data, error } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: manyChildIds
      })

      // Should either error or return warnings about exceeding limit
      expect(error || (data && data.warnings && data.warnings.length > 0)).toBeTruthy()
    })
  })

  describe('Behavioral Contract', () => {
    it('should update parent item with children array in linked_items', async () => {
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      const { data: parentItem } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      expect(parentItem?.linked_items).toBeDefined()
      expect(parentItem?.linked_items?.children).toBeDefined()
      expect(parentItem?.linked_items?.children).toContain(childItem1Id)
    })

    it('should update child items with parents array in linked_items', async () => {
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id, childItem2Id]
      })

      const { data: childItems } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [childItem1Id, childItem2Id])

      for (const child of childItems || []) {
        expect(child.linked_items).toBeDefined()
        expect(child.linked_items?.parents).toBeDefined()
        expect(child.linked_items?.parents).toContain(parentItemId)
      }
    })

    it('should preserve existing bidirectional links during conversion', async () => {
      // Setup item with legacy bidirectional links
      await supabase
        .from('items')
        .update({
          linked_items: [childItem1Id] // Legacy array format
        })
        .eq('id', parentItemId)

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem2Id]
      })

      const { data: parentItem } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      expect(parentItem?.linked_items?.bidirectional).toContain(childItem1Id)
      expect(parentItem?.linked_items?.children).toContain(childItem2Id)
    })

    it('should prevent duplicate parent-child relationships', async () => {
      // Create link once
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      // Try to create same link again
      const { data } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      // Should not create duplicate - links_created should be 0
      expect(data?.links_created).toBe(0)
    })

    it('should maintain referential integrity with bidirectional updates', async () => {
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      // Check parent has child reference
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      // Check child has parent reference
      const { data: child } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItem1Id)
        .single()

      expect(parent?.linked_items?.children).toContain(childItem1Id)
      expect(child?.linked_items?.parents).toContain(parentItemId)
    })
  })

  describe('Error Handling Contract', () => {
    it('should return error for non-existent parent item', async () => {
      const { data } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: uuidv4(),
        child_item_ids: [childItem1Id]
      })

      expect(data?.success).toBe(false)
      expect(data?.error).toContain('Parent item not found')
    })

    it('should handle non-existent child items gracefully with warnings', async () => {
      const nonExistentId = uuidv4()

      const { data } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id, nonExistentId]
      })

      expect(data?.success).toBe(true) // Should succeed for valid items
      expect(data?.links_created).toBe(1) // Only one valid link created
      expect(data?.warnings).toContain(`Child item not found: ${nonExistentId}`)
    })

    it('should prevent self-linking with warning', async () => {
      const { data } = await supabase.rpc('create_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_ids: [parentItemId]
      })

      expect(data?.warnings).toContain('Cannot link item to itself')
      expect(data?.links_created).toBe(0)
    })
  })
})