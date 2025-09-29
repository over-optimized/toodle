import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for remove_parent_child_link RPC endpoint
// This test MUST fail initially (TDD requirement)

describe('remove_parent_child_link RPC Contract', () => {
  let testUserId: string
  let testListId1: string
  let testListId2: string
  let parentItemId: string
  let childItemId: string

  beforeEach(async () => {
    // Setup test data
    testUserId = uuidv4()
    testListId1 = uuidv4()
    testListId2 = uuidv4()
    parentItemId = uuidv4()
    childItemId = uuidv4()

    // Create test user
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create test lists
    await supabase.from('lists').insert([
      {
        id: testListId1,
        user_id: testUserId,
        title: 'Parent List',
        type: 'simple'
      },
      {
        id: testListId2,
        user_id: testUserId,
        title: 'Child List',
        type: 'grocery'
      }
    ])

    // Create test items with existing parent-child relationship
    await supabase.from('items').insert([
      {
        id: parentItemId,
        list_id: testListId1,
        content: 'Parent Item',
        is_completed: false,
        position: 1,
        linked_items: {
          children: [childItemId]
        }
      },
      {
        id: childItemId,
        list_id: testListId2,
        content: 'Child Item',
        is_completed: false,
        position: 1,
        linked_items: {
          parents: [parentItemId]
        }
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItemId, childItemId])
    await supabase.from('lists').delete().in('id', [testListId1, testListId2])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Request/Response Contract', () => {
    it('should accept valid parent_item_id and child_item_id UUIDs', async () => {
      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      // Should not throw an error for valid input structure
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should return success boolean', async () => {
      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      expect(error).toBeNull()
      expect(data).toHaveProperty('success')
      expect(typeof data.success).toBe('boolean')
    })

    it('should reject invalid UUID format for parent_item_id', async () => {
      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: 'invalid-uuid',
        child_item_id: childItemId
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should reject invalid UUID format for child_item_id', async () => {
      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: 'invalid-uuid'
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should require both parent_item_id and child_item_id parameters', async () => {
      // Test missing parent_item_id
      const { error: error1 } = await supabase.rpc('remove_parent_child_link', {
        child_item_id: childItemId
      })
      expect(error1).not.toBeNull()

      // Test missing child_item_id
      const { error: error2 } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId
      })
      expect(error2).not.toBeNull()
    })
  })

  describe('Behavioral Contract', () => {
    it('should remove child from parent\'s children array', async () => {
      // Verify relationship exists
      const { data: beforeParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      expect(beforeParent?.linked_items?.children).toContain(childItemId)

      // Remove the link
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      // Verify child removed from parent's children array
      const { data: afterParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      expect(afterParent?.linked_items?.children || []).not.toContain(childItemId)
    })

    it('should remove parent from child\'s parents array', async () => {
      // Verify relationship exists
      const { data: beforeChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItemId)
        .single()

      expect(beforeChild?.linked_items?.parents).toContain(parentItemId)

      // Remove the link
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      // Verify parent removed from child's parents array
      const { data: afterChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItemId)
        .single()

      expect(afterChild?.linked_items?.parents || []).not.toContain(parentItemId)
    })

    it('should preserve other relationships when removing specific link', async () => {
      // Setup additional relationships
      const otherParentId = uuidv4()
      const otherChildId = uuidv4()

      await supabase.from('items').insert([
        {
          id: otherParentId,
          list_id: testListId1,
          content: 'Other Parent',
          is_completed: false,
          position: 2
        },
        {
          id: otherChildId,
          list_id: testListId2,
          content: 'Other Child',
          is_completed: false,
          position: 2
        }
      ])

      // Add multiple relationships
      await supabase
        .from('items')
        .update({
          linked_items: {
            children: [childItemId, otherChildId]
          }
        })
        .eq('id', parentItemId)

      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [parentItemId, otherParentId]
          }
        })
        .eq('id', childItemId)

      // Remove one specific link
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      // Verify other relationships preserved
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      const { data: child } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItemId)
        .single()

      expect(parent?.linked_items?.children).toContain(otherChildId)
      expect(child?.linked_items?.parents).toContain(otherParentId)

      // Cleanup
      await supabase.from('items').delete().in('id', [otherParentId, otherChildId])
    })

    it('should handle removal of non-existent relationship gracefully', async () => {
      // Create items without relationship
      const unrelatedParentId = uuidv4()
      const unrelatedChildId = uuidv4()

      await supabase.from('items').insert([
        {
          id: unrelatedParentId,
          list_id: testListId1,
          content: 'Unrelated Parent',
          is_completed: false,
          position: 3
        },
        {
          id: unrelatedChildId,
          list_id: testListId2,
          content: 'Unrelated Child',
          is_completed: false,
          position: 3
        }
      ])

      // Try to remove non-existent relationship
      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: unrelatedParentId,
        child_item_id: unrelatedChildId
      })

      expect(error).toBeNull()
      expect(data?.success).toBe(true) // Should succeed even if relationship doesn't exist

      // Cleanup
      await supabase.from('items').delete().in('id', [unrelatedParentId, unrelatedChildId])
    })

    it('should clean up empty arrays after removal', async () => {
      // Setup single relationship
      await supabase
        .from('items')
        .update({
          linked_items: { children: [childItemId] }
        })
        .eq('id', parentItemId)

      await supabase
        .from('items')
        .update({
          linked_items: { parents: [parentItemId] }
        })
        .eq('id', childItemId)

      // Remove the only relationship
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: childItemId
      })

      // Verify arrays are empty or fields are cleaned up appropriately
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', parentItemId)
        .single()

      const { data: child } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItemId)
        .single()

      // Arrays should be empty or undefined
      expect(parent?.linked_items?.children || []).toHaveLength(0)
      expect(child?.linked_items?.parents || []).toHaveLength(0)
    })
  })

  describe('Error Handling Contract', () => {
    it('should return error for non-existent parent item', async () => {
      const { data } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: uuidv4(),
        child_item_id: childItemId
      })

      expect(data?.success).toBe(false)
      expect(data?.error).toContain('Parent item not found')
    })

    it('should return error for non-existent child item', async () => {
      const { data } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: parentItemId,
        child_item_id: uuidv4()
      })

      expect(data?.success).toBe(false)
      expect(data?.error).toContain('Child item not found')
    })

    it('should handle items with null or undefined linked_items', async () => {
      // Create item with no linked_items
      const itemWithoutLinksId = uuidv4()
      await supabase.from('items').insert({
        id: itemWithoutLinksId,
        list_id: testListId1,
        content: 'Item without links',
        is_completed: false,
        position: 4,
        linked_items: null
      })

      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: itemWithoutLinksId,
        child_item_id: childItemId
      })

      expect(error).toBeNull()
      expect(data?.success).toBe(true) // Should handle gracefully

      // Cleanup
      await supabase.from('items').delete().eq('id', itemWithoutLinksId)
    })

    it('should handle legacy array format linked_items gracefully', async () => {
      // Create item with legacy array format
      const legacyItemId = uuidv4()
      await supabase.from('items').insert({
        id: legacyItemId,
        list_id: testListId1,
        content: 'Legacy format item',
        is_completed: false,
        position: 5,
        linked_items: [childItemId] // Legacy array format
      })

      const { data, error } = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: legacyItemId,
        child_item_id: childItemId
      })

      expect(error).toBeNull()
      expect(data?.success).toBe(true) // Should handle legacy format

      // Cleanup
      await supabase.from('items').delete().eq('id', legacyItemId)
    })
  })
})