import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for validate_link_creation RPC endpoint
// This test MUST fail initially (TDD requirement)

describe('validate_link_creation RPC Contract', () => {
  let testUserId: string
  let testListId1: string
  let testListId2: string
  let parentItemId: string
  let childItem1Id: string
  let childItem2Id: string
  let existingParentId: string

  beforeEach(async () => {
    // Setup test data
    testUserId = uuidv4()
    testListId1 = uuidv4()
    testListId2 = uuidv4()
    parentItemId = uuidv4()
    childItem1Id = uuidv4()
    childItem2Id = uuidv4()
    existingParentId = uuidv4()

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

    // Create test items
    await supabase.from('items').insert([
      {
        id: parentItemId,
        list_id: testListId1,
        content: 'Parent Item',
        is_completed: false,
        position: 1
      },
      {
        id: childItem1Id,
        list_id: testListId2,
        content: 'Child Item 1',
        is_completed: false,
        position: 1
      },
      {
        id: childItem2Id,
        list_id: testListId2,
        content: 'Child Item 2',
        is_completed: true,
        position: 2
      },
      {
        id: existingParentId,
        list_id: testListId1,
        content: 'Existing Parent',
        is_completed: false,
        position: 2,
        linked_items: {
          children: [childItem1Id] // Create existing relationship
        }
      }
    ])

    // Update child to have existing parent
    await supabase
      .from('items')
      .update({
        linked_items: {
          parents: [existingParentId]
        }
      })
      .eq('id', childItem1Id)
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItemId, childItem1Id, childItem2Id, existingParentId])
    await supabase.from('lists').delete().in('id', [testListId1, testListId2])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Request/Response Contract', () => {
    it('should accept valid parent_item_id and child_item_ids array', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id, childItem2Id]
      })

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should return LinkValidationResult structure per API contract', async () => {
      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id]
      })

      // Verify LinkValidationResult structure
      expect(data).toHaveProperty('can_link')
      expect(typeof data.can_link).toBe('boolean')

      expect(data).toHaveProperty('valid_links')
      expect(Array.isArray(data.valid_links)).toBe(true)

      expect(data).toHaveProperty('invalid_links')
      expect(Array.isArray(data.invalid_links)).toBe(true)

      expect(data).toHaveProperty('warnings')
      expect(Array.isArray(data.warnings)).toBe(true)
    })

    it('should reject invalid UUID format for parent_item_id', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        parent_item_id: 'invalid-uuid',
        child_item_ids: [childItem1Id]
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should reject invalid UUID formats in child_item_ids array', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: ['invalid-uuid', childItem1Id]
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('invalid input syntax for type uuid')
    })

    it('should require parent_item_id parameter', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        child_item_ids: [childItem1Id]
      })

      expect(error).not.toBeNull()
    })

    it('should require child_item_ids parameter', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId
      })

      expect(error).not.toBeNull()
    })

    it('should handle empty child_item_ids array', async () => {
      const { data, error } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: []
      })

      expect(error).toBeNull()
      expect(data.can_link).toBe(true)
      expect(data.valid_links).toEqual([])
      expect(data.invalid_links).toEqual([])
    })
  })

  describe('Validation Logic Contract', () => {
    it('should identify valid links correctly', async () => {
      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem2Id] // Valid new relationship
      })

      expect(data.can_link).toBe(true)
      expect(data.valid_links).toContain(childItem2Id)
      expect(data.invalid_links).toHaveLength(0)
    })

    it('should detect self-link attempts', async () => {
      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [parentItemId] // Self-link
      })

      expect(data.can_link).toBe(false)
      expect(data.valid_links).not.toContain(parentItemId)

      const invalidLink = data.invalid_links.find(link => link.child_id === parentItemId)
      expect(invalidLink).toBeDefined()
      expect(invalidLink.reason).toBe('self_link')
    })

    it('should detect circular dependencies', async () => {
      // Setup circular dependency scenario: childItem1 -> parentItemId would create cycle
      // existingParentId -> childItem1 (existing)
      // parentItemId -> childItem1 (proposed)
      // childItem1 -> parentItemId (if this existed, would create cycle)

      // Create the potential circular relationship
      await supabase
        .from('items')
        .update({
          linked_items: {
            children: [parentItemId]
          }
        })
        .eq('id', childItem1Id)

      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [childItem1Id]
          }
        })
        .eq('id', parentItemId)

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id] // This would create a cycle
      })

      expect(data.can_link).toBe(false)

      const invalidLink = data.invalid_links.find(link => link.child_id === childItem1Id)
      expect(invalidLink).toBeDefined()
      expect(invalidLink.reason).toBe('circular_dependency')
    })

    it('should detect non-existent items', async () => {
      const nonExistentId = uuidv4()

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id, nonExistentId]
      })

      expect(data.can_link).toBe(false)
      expect(data.valid_links).toContain(childItem1Id)
      expect(data.valid_links).not.toContain(nonExistentId)

      const invalidLink = data.invalid_links.find(link => link.child_id === nonExistentId)
      expect(invalidLink).toBeDefined()
      expect(invalidLink.reason).toBe('item_not_found')
    })

    it('should handle mixed valid and invalid links', async () => {
      const nonExistentId = uuidv4()

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [
          childItem2Id,     // Valid
          parentItemId,     // Invalid (self-link)
          nonExistentId     // Invalid (not found)
        ]
      })

      expect(data.can_link).toBe(false) // Has invalid links
      expect(data.valid_links).toContain(childItem2Id)
      expect(data.valid_links).not.toContain(parentItemId)
      expect(data.valid_links).not.toContain(nonExistentId)

      expect(data.invalid_links).toHaveLength(2)

      const selfLinkError = data.invalid_links.find(link => link.child_id === parentItemId)
      expect(selfLinkError?.reason).toBe('self_link')

      const notFoundError = data.invalid_links.find(link => link.child_id === nonExistentId)
      expect(notFoundError?.reason).toBe('item_not_found')
    })

    it('should allow duplicate link creation (idempotent)', async () => {
      // Try to create link that already exists (existingParentId -> childItem1Id)
      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: existingParentId,
        child_item_ids: [childItem1Id] // Already exists
      })

      expect(data.can_link).toBe(true)
      expect(data.valid_links).toContain(childItem1Id)
      expect(data.warnings).toContain('Link already exists')
    })

    it('should return appropriate warnings', async () => {
      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [childItem1Id] // Multiple parents scenario
      })

      // Should warn about multiple parents or other conditions
      if (data.warnings.length > 0) {
        expect(Array.isArray(data.warnings)).toBe(true)
        expect(typeof data.warnings[0]).toBe('string')
      }
    })
  })

  describe('Edge Cases Contract', () => {
    it('should handle parent item not found', async () => {
      const nonExistentParentId = uuidv4()

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: nonExistentParentId,
        child_item_ids: [childItem1Id]
      })

      expect(data.can_link).toBe(false)
      expect(data.invalid_links).toHaveLength(1)

      const invalidLink = data.invalid_links[0]
      expect(invalidLink.reason).toBe('item_not_found')
    })

    it('should handle cross-user validation (if implemented)', async () => {
      // Create another user and item
      const otherUserId = uuidv4()
      const otherListId = uuidv4()
      const otherItemId = uuidv4()

      await supabase.from('users').insert({
        id: otherUserId,
        email: 'other@example.com'
      })

      await supabase.from('lists').insert({
        id: otherListId,
        user_id: otherUserId,
        title: 'Other User List',
        type: 'simple'
      })

      await supabase.from('items').insert({
        id: otherItemId,
        list_id: otherListId,
        content: 'Other User Item',
        is_completed: false,
        position: 1
      })

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: [otherItemId] // Different user's item
      })

      expect(data.can_link).toBe(false)

      const invalidLink = data.invalid_links.find(link => link.child_id === otherItemId)
      expect(invalidLink).toBeDefined()
      expect(invalidLink.reason).toBe('permission_denied')

      // Cleanup
      await supabase.from('items').delete().eq('id', otherItemId)
      await supabase.from('lists').delete().eq('id', otherListId)
      await supabase.from('users').delete().eq('id', otherUserId)
    })

    it('should validate maximum children limit (if implemented)', async () => {
      // Create many child items to test limit
      const manyChildIds = []
      const insertPromises = []

      for (let i = 0; i < 25; i++) {
        const childId = uuidv4()
        manyChildIds.push(childId)
        insertPromises.push(
          supabase.from('items').insert({
            id: childId,
            list_id: testListId2,
            content: `Child ${i}`,
            is_completed: false,
            position: i + 10
          })
        )
      }

      await Promise.all(insertPromises)

      const { data } = await supabase.rpc('validate_link_creation', {
        parent_item_id: parentItemId,
        child_item_ids: manyChildIds
      })

      // May warn about too many children or validate normally
      expect(data).toBeDefined()
      expect(typeof data.can_link).toBe('boolean')

      // Cleanup
      await supabase.from('items').delete().in('id', manyChildIds)
    })

    it('should handle complex circular dependency chains', async () => {
      // Create chain: A -> B -> C, then try A -> C (should be valid)
      // and C -> A (should be circular)
      const itemA = uuidv4()
      const itemB = uuidv4()
      const itemC = uuidv4()

      await supabase.from('items').insert([
        {
          id: itemA,
          list_id: testListId1,
          content: 'Item A',
          is_completed: false,
          position: 10,
          linked_items: { children: [itemB] }
        },
        {
          id: itemB,
          list_id: testListId1,
          content: 'Item B',
          is_completed: false,
          position: 11,
          linked_items: { parents: [itemA], children: [itemC] }
        },
        {
          id: itemC,
          list_id: testListId1,
          content: 'Item C',
          is_completed: false,
          position: 12,
          linked_items: { parents: [itemB] }
        }
      ])

      // Test direct link A -> C (should be valid, no cycle)
      const { data: validResult } = await supabase.rpc('validate_link_creation', {
        parent_item_id: itemA,
        child_item_ids: [itemC]
      })
      expect(validResult.can_link).toBe(true)

      // Test circular link C -> A (should be invalid, creates cycle)
      const { data: circularResult } = await supabase.rpc('validate_link_creation', {
        parent_item_id: itemC,
        child_item_ids: [itemA]
      })
      expect(circularResult.can_link).toBe(false)

      const circularError = circularResult.invalid_links.find(link => link.child_id === itemA)
      expect(circularError?.reason).toBe('circular_dependency')

      // Cleanup
      await supabase.from('items').delete().in('id', [itemA, itemB, itemC])
    })
  })
})