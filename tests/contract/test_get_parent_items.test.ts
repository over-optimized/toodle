import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for get_parent_items RPC endpoint
// This test MUST fail initially (TDD requirement)

describe('get_parent_items RPC Contract', () => {
  let testUserId: string
  let parentListId1: string
  let parentListId2: string
  let childListId: string
  let parentItem1Id: string
  let parentItem2Id: string
  let childItemId: string
  let unrelatedItemId: string

  beforeEach(async () => {
    // Setup test data
    testUserId = uuidv4()
    parentListId1 = uuidv4()
    parentListId2 = uuidv4()
    childListId = uuidv4()
    parentItem1Id = uuidv4()
    parentItem2Id = uuidv4()
    childItemId = uuidv4()
    unrelatedItemId = uuidv4()

    // Create test user
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create test lists
    await supabase.from('lists').insert([
      {
        id: parentListId1,
        user_id: testUserId,
        title: 'Meal Planning',
        type: 'simple'
      },
      {
        id: parentListId2,
        user_id: testUserId,
        title: 'Event Planning',
        type: 'simple'
      },
      {
        id: childListId,
        user_id: testUserId,
        title: 'Shopping List',
        type: 'grocery'
      }
    ])

    // Create parent items
    await supabase.from('items').insert([
      {
        id: parentItem1Id,
        list_id: parentListId1,
        content: 'Dinner Party',
        is_completed: false,
        position: 1,
        linked_items: {
          children: [childItemId]
        }
      },
      {
        id: parentItem2Id,
        list_id: parentListId2,
        content: 'Birthday Party',
        is_completed: true,
        position: 1,
        linked_items: {
          children: [childItemId]
        }
      }
    ])

    // Create child item with multiple parents
    await supabase.from('items').insert({
      id: childItemId,
      list_id: childListId,
      content: 'Buy Decorations',
      is_completed: false,
      position: 1,
      linked_items: {
        parents: [parentItem1Id, parentItem2Id]
      }
    })

    // Create unrelated item
    await supabase.from('items').insert({
      id: unrelatedItemId,
      list_id: childListId,
      content: 'Unrelated Item',
      is_completed: false,
      position: 2
      // No parent relationships
    })
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItem1Id, parentItem2Id, childItemId, unrelatedItemId])
    await supabase.from('lists').delete().in('id', [parentListId1, parentListId2, childListId])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Request/Response Contract', () => {
    it('should accept valid child_item_id UUID parameter', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should reject invalid UUID format for child_item_id', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: 'invalid-uuid'
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should require child_item_id parameter', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {})

      expect(error).not.toBeNull()
    })

    it('should return array of LinkedItemInfo objects', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)

      if (data && data.length > 0) {
        const parentItem = data[0]

        // Verify LinkedItemInfo structure from API contract
        expect(parentItem).toHaveProperty('id')
        expect(parentItem).toHaveProperty('list_id')
        expect(parentItem).toHaveProperty('content')
        expect(parentItem).toHaveProperty('is_completed')
        expect(parentItem).toHaveProperty('list_title')
        expect(parentItem).toHaveProperty('list_type')

        // Verify data types match contract
        expect(typeof parentItem.id).toBe('string')
        expect(typeof parentItem.list_id).toBe('string')
        expect(typeof parentItem.content).toBe('string')
        expect(typeof parentItem.is_completed).toBe('boolean')
        expect(typeof parentItem.list_title).toBe('string')
        expect(['simple', 'grocery', 'countdown']).toContain(parentItem.list_type)
      }
    })
  })

  describe('Behavioral Contract', () => {
    it('should return all direct parents of the child item', async () => {
      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      expect(data).toHaveLength(2)

      const parentIds = data?.map(item => item.id) || []
      expect(parentIds).toContain(parentItem1Id)
      expect(parentIds).toContain(parentItem2Id)
      expect(parentIds).not.toContain(unrelatedItemId) // Unrelated item
    })

    it('should include parent item completion status', async () => {
      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      const dinnerParty = data?.find(item => item.id === parentItem1Id)
      const birthdayParty = data?.find(item => item.id === parentItem2Id)

      expect(dinnerParty?.is_completed).toBe(false)
      expect(birthdayParty?.is_completed).toBe(true)
    })

    it('should include list information for each parent', async () => {
      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      for (const parentItem of data || []) {
        expect(parentItem.list_title).toBeDefined()
        expect(parentItem.list_type).toBeDefined()
        expect(['simple', 'grocery', 'countdown']).toContain(parentItem.list_type)
      }

      // Verify specific list titles are included
      const listTitles = data?.map(item => item.list_title) || []
      expect(listTitles).toContain('Meal Planning')
      expect(listTitles).toContain('Event Planning')
    })

    it('should return items ordered by list title then position', async () => {
      // Add another parent with alphabetically first list name
      const firstListId = uuidv4()
      const firstParentId = uuidv4()

      await supabase.from('lists').insert({
        id: firstListId,
        user_id: testUserId,
        title: 'A-First List',
        type: 'simple'
      })

      await supabase.from('items').insert({
        id: firstParentId,
        list_id: firstListId,
        content: 'First Parent',
        is_completed: false,
        position: 1,
        linked_items: {
          children: [childItemId]
        }
      })

      // Update child to include new parent
      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [parentItem1Id, parentItem2Id, firstParentId]
          }
        })
        .eq('id', childItemId)

      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: childItemId
      })

      expect(data?.length).toBeGreaterThanOrEqual(3)

      // First item should be from "A-First List" due to alphabetical ordering
      expect(data?.[0]?.list_title).toBe('A-First List')

      // Cleanup
      await supabase.from('items').delete().eq('id', firstParentId)
      await supabase.from('lists').delete().eq('id', firstListId)
    })

    it('should return empty array for item with no parents', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: unrelatedItemId
      })

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should handle items with legacy array format linked_items', async () => {
      // Create child with legacy format
      const legacyChildId = uuidv4()
      await supabase.from('items').insert({
        id: legacyChildId,
        list_id: childListId,
        content: 'Legacy Child',
        is_completed: false,
        position: 3,
        linked_items: [parentItem1Id] // Legacy array format (no parents concept)
      })

      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: legacyChildId
      })

      expect(error).toBeNull()
      expect(data).toEqual([]) // Legacy format has no parents concept

      // Cleanup
      await supabase.from('items').delete().eq('id', legacyChildId)
    })

    it('should handle null linked_items gracefully', async () => {
      // Create child with null linked_items
      const nullChildId = uuidv4()
      await supabase.from('items').insert({
        id: nullChildId,
        list_id: childListId,
        content: 'Child with null links',
        is_completed: false,
        position: 4,
        linked_items: null
      })

      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: nullChildId
      })

      expect(error).toBeNull()
      expect(data).toEqual([])

      // Cleanup
      await supabase.from('items').delete().eq('id', nullChildId)
    })

    it('should handle single parent relationship', async () => {
      // Create child with only one parent
      const singleParentChildId = uuidv4()
      await supabase.from('items').insert({
        id: singleParentChildId,
        list_id: childListId,
        content: 'Single Parent Child',
        is_completed: false,
        position: 5,
        linked_items: {
          parents: [parentItem1Id]
        }
      })

      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: singleParentChildId
      })

      expect(data).toHaveLength(1)
      expect(data?.[0]?.id).toBe(parentItem1Id)

      // Cleanup
      await supabase.from('items').delete().eq('id', singleParentChildId)
    })
  })

  describe('Error Handling Contract', () => {
    it('should return empty array for non-existent child item', async () => {
      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: uuidv4()
      })

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should handle orphaned parent references gracefully', async () => {
      // Create child with reference to non-existent parent
      const childWithOrphansId = uuidv4()
      const nonExistentParentId = uuidv4()

      await supabase.from('items').insert({
        id: childWithOrphansId,
        list_id: childListId,
        content: 'Child with orphan refs',
        is_completed: false,
        position: 6,
        linked_items: {
          parents: [parentItem1Id, nonExistentParentId] // One valid, one orphaned
        }
      })

      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: childWithOrphansId
      })

      expect(error).toBeNull()
      expect(data).toHaveLength(1) // Should return only valid parent
      expect(data?.[0]?.id).toBe(parentItem1Id)

      // Cleanup
      await supabase.from('items').delete().eq('id', childWithOrphansId)
    })

    it('should handle corrupted linked_items data structure', async () => {
      // Create child with invalid linked_items structure
      const corruptedChildId = uuidv4()

      await supabase.from('items').insert({
        id: corruptedChildId,
        list_id: childListId,
        content: 'Corrupted child',
        is_completed: false,
        position: 7,
        linked_items: {
          parents: 'not-an-array' // Invalid structure
        }
      })

      const { data, error } = await supabase.rpc('get_parent_items', {
        child_item_id: corruptedChildId
      })

      // Should handle gracefully without crashing
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)

      // Cleanup
      await supabase.from('items').delete().eq('id', corruptedChildId)
    })

    it('should handle mixed relationship types', async () => {
      // Create child with mixed relationship types
      const mixedChildId = uuidv4()
      await supabase.from('items').insert({
        id: mixedChildId,
        list_id: childListId,
        content: 'Mixed relationships child',
        is_completed: false,
        position: 8,
        linked_items: {
          parents: [parentItem1Id],
          children: [unrelatedItemId],
          bidirectional: [parentItem2Id]
        }
      })

      const { data } = await supabase.rpc('get_parent_items', {
        child_item_id: mixedChildId
      })

      // Should return only items from parents array
      expect(data).toHaveLength(1)
      expect(data?.[0]?.id).toBe(parentItem1Id)

      // Should not return items from children or bidirectional arrays
      const parentIds = data?.map(item => item.id) || []
      expect(parentIds).not.toContain(parentItem2Id) // In bidirectional
      expect(parentIds).not.toContain(unrelatedItemId) // In children

      // Cleanup
      await supabase.from('items').delete().eq('id', mixedChildId)
    })
  })
})