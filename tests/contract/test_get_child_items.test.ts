import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for get_child_items RPC endpoint
// This test MUST fail initially (TDD requirement)

describe('get_child_items RPC Contract', () => {
  let testUserId: string
  let parentListId: string
  let childListId1: string
  let childListId2: string
  let parentItemId: string
  let childItem1Id: string
  let childItem2Id: string
  let childItem3Id: string

  beforeEach(async () => {
    // Setup test data
    testUserId = uuidv4()
    parentListId = uuidv4()
    childListId1 = uuidv4()
    childListId2 = uuidv4()
    parentItemId = uuidv4()
    childItem1Id = uuidv4()
    childItem2Id = uuidv4()
    childItem3Id = uuidv4()

    // Create test user
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create test lists
    await supabase.from('lists').insert([
      {
        id: parentListId,
        user_id: testUserId,
        title: 'Meal Planning',
        type: 'simple'
      },
      {
        id: childListId1,
        user_id: testUserId,
        title: 'Grocery List',
        type: 'grocery'
      },
      {
        id: childListId2,
        user_id: testUserId,
        title: 'Shopping Tasks',
        type: 'simple'
      }
    ])

    // Create parent item with children
    await supabase.from('items').insert({
      id: parentItemId,
      list_id: parentListId,
      content: 'Dinner Party',
      is_completed: false,
      position: 1,
      linked_items: {
        children: [childItem1Id, childItem2Id]
      }
    })

    // Create child items
    await supabase.from('items').insert([
      {
        id: childItem1Id,
        list_id: childListId1,
        content: 'Salmon',
        is_completed: false,
        position: 1,
        linked_items: {
          parents: [parentItemId]
        }
      },
      {
        id: childItem2Id,
        list_id: childListId1,
        content: 'Vegetables',
        is_completed: true,
        position: 2,
        linked_items: {
          parents: [parentItemId]
        }
      },
      {
        id: childItem3Id,
        list_id: childListId2,
        content: 'Unrelated Item',
        is_completed: false,
        position: 1
        // No parent relationship
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItemId, childItem1Id, childItem2Id, childItem3Id])
    await supabase.from('lists').delete().in('id', [parentListId, childListId1, childListId2])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Request/Response Contract', () => {
    it('should accept valid parent_item_id UUID parameter', async () => {
      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should reject invalid UUID format for parent_item_id', async () => {
      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: 'invalid-uuid'
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should require parent_item_id parameter', async () => {
      const { data, error } = await supabase.rpc('get_child_items', {})

      expect(error).not.toBeNull()
    })

    it('should return array of LinkedItemInfo objects', async () => {
      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)

      if (data && data.length > 0) {
        const childItem = data[0]

        // Verify LinkedItemInfo structure from API contract
        expect(childItem).toHaveProperty('id')
        expect(childItem).toHaveProperty('list_id')
        expect(childItem).toHaveProperty('content')
        expect(childItem).toHaveProperty('is_completed')
        expect(childItem).toHaveProperty('list_title')
        expect(childItem).toHaveProperty('list_type')

        // Verify data types match contract
        expect(typeof childItem.id).toBe('string')
        expect(typeof childItem.list_id).toBe('string')
        expect(typeof childItem.content).toBe('string')
        expect(typeof childItem.is_completed).toBe('boolean')
        expect(typeof childItem.list_title).toBe('string')
        expect(['simple', 'grocery', 'countdown']).toContain(childItem.list_type)
      }
    })
  })

  describe('Behavioral Contract', () => {
    it('should return only direct children of the parent item', async () => {
      const { data } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      expect(data).toHaveLength(2)

      const childIds = data?.map(item => item.id) || []
      expect(childIds).toContain(childItem1Id)
      expect(childIds).toContain(childItem2Id)
      expect(childIds).not.toContain(childItem3Id) // Unrelated item
    })

    it('should include child item completion status', async () => {
      const { data } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      const salmon = data?.find(item => item.id === childItem1Id)
      const vegetables = data?.find(item => item.id === childItem2Id)

      expect(salmon?.is_completed).toBe(false)
      expect(vegetables?.is_completed).toBe(true)
    })

    it('should include list information for each child', async () => {
      const { data } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      for (const childItem of data || []) {
        expect(childItem.list_title).toBeDefined()
        expect(childItem.list_type).toBeDefined()
        expect(['simple', 'grocery', 'countdown']).toContain(childItem.list_type)
      }

      // Verify specific list titles
      const groceryItems = data?.filter(item => item.list_type === 'grocery') || []
      expect(groceryItems.every(item => item.list_title === 'Grocery List')).toBe(true)
    })

    it('should return items ordered by list title then position', async () => {
      // Add more children across different lists to test ordering
      const additionalChildId = uuidv4()
      const alphabeticallyFirstListId = uuidv4()

      await supabase.from('lists').insert({
        id: alphabeticallyFirstListId,
        user_id: testUserId,
        title: 'A-First List', // Alphabetically first
        type: 'simple'
      })

      await supabase.from('items').insert({
        id: additionalChildId,
        list_id: alphabeticallyFirstListId,
        content: 'First Item',
        is_completed: false,
        position: 1,
        linked_items: {
          parents: [parentItemId]
        }
      })

      // Update parent to include new child
      await supabase
        .from('items')
        .update({
          linked_items: {
            children: [childItem1Id, childItem2Id, additionalChildId]
          }
        })
        .eq('id', parentItemId)

      const { data } = await supabase.rpc('get_child_items', {
        parent_item_id: parentItemId
      })

      expect(data?.length).toBeGreaterThanOrEqual(3)

      // First item should be from "A-First List"
      expect(data?.[0]?.list_title).toBe('A-First List')

      // Cleanup
      await supabase.from('items').delete().eq('id', additionalChildId)
      await supabase.from('lists').delete().eq('id', alphabeticallyFirstListId)
    })

    it('should return empty array for item with no children', async () => {
      // Create item with no children
      const parentWithoutChildrenId = uuidv4()
      await supabase.from('items').insert({
        id: parentWithoutChildrenId,
        list_id: parentListId,
        content: 'Parent without children',
        is_completed: false,
        position: 2
      })

      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: parentWithoutChildrenId
      })

      expect(error).toBeNull()
      expect(data).toEqual([])

      // Cleanup
      await supabase.from('items').delete().eq('id', parentWithoutChildrenId)
    })

    it('should handle items with legacy array format linked_items', async () => {
      // Create parent with legacy format
      const legacyParentId = uuidv4()
      await supabase.from('items').insert({
        id: legacyParentId,
        list_id: parentListId,
        content: 'Legacy Parent',
        is_completed: false,
        position: 3,
        linked_items: [childItem1Id] // Legacy array format (no children)
      })

      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: legacyParentId
      })

      expect(error).toBeNull()
      expect(data).toEqual([]) // Legacy format has no children concept

      // Cleanup
      await supabase.from('items').delete().eq('id', legacyParentId)
    })

    it('should handle null linked_items gracefully', async () => {
      // Create parent with null linked_items
      const nullParentId = uuidv4()
      await supabase.from('items').insert({
        id: nullParentId,
        list_id: parentListId,
        content: 'Parent with null links',
        is_completed: false,
        position: 4,
        linked_items: null
      })

      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: nullParentId
      })

      expect(error).toBeNull()
      expect(data).toEqual([])

      // Cleanup
      await supabase.from('items').delete().eq('id', nullParentId)
    })
  })

  describe('Error Handling Contract', () => {
    it('should return empty array for non-existent parent item', async () => {
      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: uuidv4()
      })

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should handle orphaned child references gracefully', async () => {
      // Create parent with reference to non-existent child
      const parentWithOrphansId = uuidv4()
      const nonExistentChildId = uuidv4()

      await supabase.from('items').insert({
        id: parentWithOrphansId,
        list_id: parentListId,
        content: 'Parent with orphan refs',
        is_completed: false,
        position: 5,
        linked_items: {
          children: [childItem1Id, nonExistentChildId] // One valid, one orphaned
        }
      })

      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: parentWithOrphansId
      })

      expect(error).toBeNull()
      expect(data).toHaveLength(1) // Should return only valid child
      expect(data?.[0]?.id).toBe(childItem1Id)

      // Cleanup
      await supabase.from('items').delete().eq('id', parentWithOrphansId)
    })

    it('should handle corrupted linked_items data structure', async () => {
      // Create parent with invalid linked_items structure
      const corruptedParentId = uuidv4()

      await supabase.from('items').insert({
        id: corruptedParentId,
        list_id: parentListId,
        content: 'Corrupted parent',
        is_completed: false,
        position: 6,
        linked_items: {
          children: 'not-an-array' // Invalid structure
        }
      })

      const { data, error } = await supabase.rpc('get_child_items', {
        parent_item_id: corruptedParentId
      })

      // Should handle gracefully without crashing
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)

      // Cleanup
      await supabase.from('items').delete().eq('id', corruptedParentId)
    })
  })
})