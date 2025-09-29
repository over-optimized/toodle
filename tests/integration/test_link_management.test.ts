import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for link management and removal
// Tests Quickstart Scenario 6: Link Management
// This test MUST fail initially (TDD requirement)

describe('Link Management Integration', () => {
  let testUserId: string
  let mealListId: string
  let groceryListId: string
  let steakDinnerId: string
  let steakId: string
  let potatoesId: string
  let carrotsId: string
  let mushroomsId: string
  let wineId: string

  beforeEach(async () => {
    // Setup test data matching quickstart scenario
    testUserId = uuidv4()
    mealListId = uuidv4()
    groceryListId = uuidv4()
    steakDinnerId = uuidv4()
    steakId = uuidv4()
    potatoesId = uuidv4()
    carrotsId = uuidv4()
    mushroomsId = uuidv4()
    wineId = uuidv4()

    // Create test user
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create lists
    await supabase.from('lists').insert([
      {
        id: mealListId,
        user_id: testUserId,
        title: 'Meal Planning',
        type: 'simple'
      },
      {
        id: groceryListId,
        user_id: testUserId,
        title: 'Shopping',
        type: 'grocery'
      }
    ])

    // Create items as per quickstart scenario
    await supabase.from('items').insert([
      {
        id: steakDinnerId,
        list_id: mealListId,
        content: 'Steak Dinner',
        is_completed: false,
        position: 1
      },
      {
        id: steakId,
        list_id: groceryListId,
        content: 'Steak',
        is_completed: false,
        position: 1
      },
      {
        id: potatoesId,
        list_id: groceryListId,
        content: 'Potatoes',
        is_completed: false,
        position: 2
      },
      {
        id: carrotsId,
        list_id: groceryListId,
        content: 'Carrots',
        is_completed: false,
        position: 3
      },
      {
        id: mushroomsId,
        list_id: groceryListId,
        content: 'Mushrooms',
        is_completed: false,
        position: 4
      },
      {
        id: wineId,
        list_id: groceryListId,
        content: 'Wine',
        is_completed: false,
        position: 5
      }
    ])

    // Create initial parent-child relationships
    await supabase.rpc('create_parent_child_link', {
      parent_item_id: steakDinnerId,
      child_item_ids: [steakId, potatoesId, carrotsId, mushroomsId, wineId]
    })
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, steakId, potatoesId, carrotsId, mushroomsId, wineId])
    await supabase.from('lists').delete().in('id', [mealListId, groceryListId])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Link Removal Workflow', () => {
    it('should remove specific links and update indicators correctly', async () => {
      // Verify initial state: Steak Dinner has 5 children
      const { data: initialParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(initialParent?.linked_items?.children).toHaveLength(5)
      expect(initialParent?.linked_items?.children).toContain(mushroomsId)

      // **Key Action**: Remove link to Mushrooms
      const removeResult = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: mushroomsId
      })

      expect(removeResult.data?.success).toBe(true)

      // Verify parent now shows 4 children (🔗⬇️4)
      const { data: afterRemoval } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(afterRemoval?.linked_items?.children).toHaveLength(4)
      expect(afterRemoval?.linked_items?.children).not.toContain(mushroomsId)
      expect(afterRemoval?.linked_items?.children).toContain(steakId)
      expect(afterRemoval?.linked_items?.children).toContain(potatoesId)
      expect(afterRemoval?.linked_items?.children).toContain(carrotsId)
      expect(afterRemoval?.linked_items?.children).toContain(wineId)

      // Verify mushrooms no longer shows link indicator
      const { data: unlinkedChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', mushroomsId)
        .single()

      expect(unlinkedChild?.linked_items?.parents || []).not.toContain(steakDinnerId)
    })

    it('should support progressive link removal', async () => {
      // Remove multiple links progressively
      const removalSequence = [mushroomsId, wineId, carrotsId]
      const expectedCounts = [4, 3, 2] // After each removal

      for (let i = 0; i < removalSequence.length; i++) {
        await supabase.rpc('remove_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_id: removalSequence[i]
        })

        // Verify count after each removal
        const { data: parent } = await supabase
          .from('items')
          .select('linked_items')
          .eq('id', steakDinnerId)
          .single()

        expect(parent?.linked_items?.children).toHaveLength(expectedCounts[i])
        expect(parent?.linked_items?.children).not.toContain(removalSequence[i])
      }

      // Verify remaining items still linked
      const { data: finalParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(finalParent?.linked_items?.children).toContain(steakId)
      expect(finalParent?.linked_items?.children).toContain(potatoesId)
    })

    it('should handle removal of non-existent relationships gracefully', async () => {
      // First remove a valid relationship
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: mushroomsId
      })

      // Try to remove the same relationship again
      const secondRemoval = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: mushroomsId
      })

      expect(secondRemoval.data?.success).toBe(true) // Should succeed gracefully
      expect(secondRemoval.error).toBeNull()

      // State should be unchanged
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.linked_items?.children).toHaveLength(4) // Still 4
      expect(parent?.linked_items?.children).not.toContain(mushroomsId)
    })
  })

  describe('Link Details and Information Display', () => {
    it('should provide comprehensive link information for UI display', async () => {
      // Test getting child items with full information
      const childrenResult = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      expect(childrenResult.data).toHaveLength(5)

      // Verify each child has complete UI information
      for (const child of childrenResult.data || []) {
        expect(child.id).toBeDefined()
        expect(child.content).toBeDefined()
        expect(typeof child.is_completed).toBe('boolean')
        expect(child.list_title).toBeDefined()
        expect(child.list_type).toBeDefined()

        // Verify list information is correct
        expect(child.list_title).toBe('Shopping')
        expect(child.list_type).toBe('grocery')
      }

      // Test getting parent items (from child perspective)
      const parentsResult = await supabase.rpc('get_parent_items', {
        child_item_id: steakId
      })

      expect(parentsResult.data).toHaveLength(1)

      const parentInfo = parentsResult.data?.[0]
      expect(parentInfo?.id).toBe(steakDinnerId)
      expect(parentInfo?.content).toBe('Steak Dinner')
      expect(parentInfo?.list_title).toBe('Meal Planning')
      expect(parentInfo?.list_type).toBe('simple')
    })

    it('should show clear distinction between parent and child relationships', async () => {
      // Create a mixed relationship scenario
      const mixedItemId = uuidv4()
      await supabase.from('items').insert({
        id: mixedItemId,
        list_id: groceryListId,
        content: 'Mixed Item',
        is_completed: false,
        position: 6
      })

      // Make mixed item both a parent and child
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [mixedItemId] // Mixed item as child
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: mixedItemId,
        child_item_ids: [steakId] // Mixed item as parent (Steak now has 2 parents)
      })

      // Test UI can distinguish relationships
      const mixedChildrenResult = await supabase.rpc('get_child_items', {
        parent_item_id: mixedItemId
      })

      const mixedParentsResult = await supabase.rpc('get_parent_items', {
        child_item_id: mixedItemId
      })

      expect(mixedChildrenResult.data).toHaveLength(1) // Mixed item has 1 child (Steak)
      expect(mixedParentsResult.data).toHaveLength(1) // Mixed item has 1 parent (Steak Dinner)

      expect(mixedChildrenResult.data?.[0]?.id).toBe(steakId)
      expect(mixedParentsResult.data?.[0]?.id).toBe(steakDinnerId)

      // Verify Steak now shows 2 parents
      const steakParentsResult = await supabase.rpc('get_parent_items', {
        child_item_id: steakId
      })

      expect(steakParentsResult.data).toHaveLength(2)
      const parentIds = steakParentsResult.data?.map(p => p.id) || []
      expect(parentIds).toContain(steakDinnerId)
      expect(parentIds).toContain(mixedItemId)

      // Cleanup
      await supabase.from('items').delete().eq('id', mixedItemId)
    })

    it('should support efficient bulk link information queries', async () => {
      // Test getting information for multiple items at once
      const allItemIds = [steakDinnerId, steakId, potatoesId, carrotsId, mushroomsId, wineId]

      const { data: allItems } = await supabase
        .from('items')
        .select('id, content, linked_items, lists!inner(title, type)')
        .in('id', allItemIds)

      expect(allItems).toHaveLength(6)

      // Calculate link indicators for UI
      const linkIndicators = allItems?.map(item => {
        const childrenCount = item.linked_items?.children?.length || 0
        const parentsCount = item.linked_items?.parents?.length || 0
        const bidirectionalCount = item.linked_items?.bidirectional?.length || 0

        return {
          id: item.id,
          content: item.content,
          type: childrenCount > 0 && parentsCount > 0 ? 'mixed' :
                childrenCount > 0 ? 'parent' :
                parentsCount > 0 ? 'child' :
                bidirectionalCount > 0 ? 'bidirectional' : 'none',
          displayText: childrenCount > 0 && parentsCount > 0 ? `🔗⬇️${childrenCount}⬆️${parentsCount}` :
                      childrenCount > 0 ? `🔗⬇️${childrenCount}` :
                      parentsCount > 0 ? `🔗⬆️${parentsCount}` :
                      bidirectionalCount > 0 ? `🔗${bidirectionalCount}` : '',
          ariaLabel: childrenCount > 0 && parentsCount > 0 ? `${childrenCount} children, ${parentsCount} parents` :
                    childrenCount > 0 ? `${childrenCount} children` :
                    parentsCount > 0 ? `${parentsCount} parents` :
                    bidirectionalCount > 0 ? `${bidirectionalCount} links` : 'no links'
        }
      })

      // Verify parent item indicator
      const parentIndicator = linkIndicators?.find(i => i.id === steakDinnerId)
      expect(parentIndicator?.type).toBe('parent')
      expect(parentIndicator?.displayText).toBe('🔗⬇️5')
      expect(parentIndicator?.ariaLabel).toBe('5 children')

      // Verify child item indicators
      const childIndicators = linkIndicators?.filter(i => i.id !== steakDinnerId)
      for (const childIndicator of childIndicators || []) {
        expect(childIndicator.type).toBe('child')
        expect(childIndicator.displayText).toBe('🔗⬆️1')
        expect(childIndicator.ariaLabel).toBe('1 parents')
      }
    })
  })

  describe('Complex Link Management Scenarios', () => {
    it('should handle removal from complex hierarchies', async () => {
      // Create multi-level hierarchy for testing
      const intermediateId = uuidv4()
      const deepChildId = uuidv4()

      await supabase.from('items').insert([
        {
          id: intermediateId,
          list_id: groceryListId,
          content: 'Intermediate Item',
          is_completed: false,
          position: 7
        },
        {
          id: deepChildId,
          list_id: groceryListId,
          content: 'Deep Child',
          is_completed: false,
          position: 8
        }
      ])

      // Create hierarchy: Steak Dinner → Steak → Intermediate → Deep Child
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [intermediateId]
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: intermediateId,
        child_item_ids: [deepChildId]
      })

      // Verify hierarchy established
      const hierarchy = await Promise.all([
        supabase.rpc('get_child_items', { parent_item_id: steakDinnerId }),
        supabase.rpc('get_child_items', { parent_item_id: steakId }),
        supabase.rpc('get_child_items', { parent_item_id: intermediateId })
      ])

      expect(hierarchy[0].data?.some(c => c.id === steakId)).toBe(true)
      expect(hierarchy[1].data?.some(c => c.id === intermediateId)).toBe(true)
      expect(hierarchy[2].data?.some(c => c.id === deepChildId)).toBe(true)

      // Remove middle link
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakId,
        child_item_id: intermediateId
      })

      // Verify hierarchy broken at correct point
      const afterRemoval = await Promise.all([
        supabase.rpc('get_child_items', { parent_item_id: steakDinnerId }),
        supabase.rpc('get_child_items', { parent_item_id: steakId }),
        supabase.rpc('get_parent_items', { child_item_id: intermediateId })
      ])

      expect(afterRemoval[0].data?.some(c => c.id === steakId)).toBe(true) // Top level preserved
      expect(afterRemoval[1].data?.some(c => c.id === intermediateId)).toBe(false) // Middle link broken
      expect(afterRemoval[2].data?.some(p => p.id === steakId)).toBe(false) // Intermediate orphaned

      // But lower hierarchy should remain intact
      const lowerHierarchy = await supabase.rpc('get_child_items', {
        parent_item_id: intermediateId
      })
      expect(lowerHierarchy.data?.some(c => c.id === deepChildId)).toBe(true)

      // Cleanup
      await supabase.from('items').delete().in('id', [intermediateId, deepChildId])
    })

    it('should maintain consistency during concurrent link management', async () => {
      // Test concurrent link removals
      const concurrentRemovals = [
        supabase.rpc('remove_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_id: mushroomsId
        }),
        supabase.rpc('remove_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_id: wineId
        })
      ]

      const results = await Promise.all(concurrentRemovals)

      // Both should succeed
      expect(results[0].data?.success).toBe(true)
      expect(results[1].data?.success).toBe(true)

      // Verify final state is consistent
      const { data: finalParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(finalParent?.linked_items?.children).toHaveLength(3)
      expect(finalParent?.linked_items?.children).not.toContain(mushroomsId)
      expect(finalParent?.linked_items?.children).not.toContain(wineId)
      expect(finalParent?.linked_items?.children).toContain(steakId)
      expect(finalParent?.linked_items?.children).toContain(potatoesId)
      expect(finalParent?.linked_items?.children).toContain(carrotsId)
    })

    it('should handle link management with status propagation active', async () => {
      // Set up scenario where status propagation would occur
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, steakId, potatoesId])

      // Leave carrots, mushrooms, wine as todo
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .in('id', [carrotsId, mushroomsId, wineId])

      // Remove link to completed item
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      // Trigger status propagation
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify unlinked item not affected by propagation
      const { data: finalStates } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakId, potatoesId, carrotsId])

      const steak = finalStates?.find(i => i.id === steakId)
      const potatoes = finalStates?.find(i => i.id === potatoesId)
      const carrots = finalStates?.find(i => i.id === carrotsId)

      expect(steak?.is_completed).toBe(true) // Unlinked, should remain completed
      expect(potatoes?.is_completed).toBe(false) // Linked, should propagate to todo
      expect(carrots?.is_completed).toBe(false) // Linked, was already todo
    })
  })

  describe('Link Management Error Handling', () => {
    it('should handle removal from non-existent items gracefully', async () => {
      const nonExistentId = uuidv4()

      const removeFromNonExistent = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: nonExistentId,
        child_item_id: steakId
      })

      expect(removeFromNonExistent.data?.success).toBe(false)
      expect(removeFromNonExistent.data?.error).toContain('Parent item not found')

      const removeNonExistent = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: nonExistentId
      })

      expect(removeNonExistent.data?.success).toBe(false)
      expect(removeNonExistent.data?.error).toContain('Child item not found')
    })

    it('should maintain referential integrity during failed operations', async () => {
      // Get initial state
      const { data: initialState } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId])

      // Attempt invalid removal
      const invalidRemoval = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: uuidv4()
      })

      expect(invalidRemoval.data?.success).toBe(false)

      // Verify state unchanged
      const { data: afterFailure } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId])

      expect(afterFailure).toEqual(initialState)
    })

    it('should provide clear error messages for UI feedback', async () => {
      const errorScenarios = [
        {
          parentId: uuidv4(),
          childId: steakId,
          expectedError: 'Parent item not found'
        },
        {
          parentId: steakDinnerId,
          childId: uuidv4(),
          expectedError: 'Child item not found'
        }
      ]

      for (const scenario of errorScenarios) {
        const result = await supabase.rpc('remove_parent_child_link', {
          parent_item_id: scenario.parentId,
          child_item_id: scenario.childId
        })

        expect(result.data?.success).toBe(false)
        expect(result.data?.error).toContain(scenario.expectedError)
      }
    })
  })

  describe('Link Information Query Performance', () => {
    it('should retrieve link information efficiently for UI rendering', async () => {
      const startTime = Date.now()

      // Simulate UI loading all link information at once
      const uiQueries = await Promise.all([
        supabase.rpc('get_child_items', { parent_item_id: steakDinnerId }),
        supabase.rpc('get_parent_items', { child_item_id: steakId }),
        supabase.rpc('get_parent_items', { child_item_id: potatoesId }),
        supabase.rpc('get_parent_items', { child_item_id: carrotsId })
      ])

      const endTime = Date.now()

      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(200)

      // All queries should succeed
      for (const query of uiQueries) {
        expect(query.error).toBeNull()
        expect(Array.isArray(query.data)).toBe(true)
      }

      // Verify data completeness for UI needs
      const childItems = uiQueries[0].data || []
      expect(childItems).toHaveLength(5)

      for (const child of childItems) {
        expect(child.content).toBeDefined()
        expect(child.list_title).toBeDefined()
        expect(typeof child.is_completed).toBe('boolean')
      }
    })

    it('should handle large numbers of links efficiently', async () => {
      // This test would be expanded with more items in a real scenario
      // For now, verify current performance is acceptable
      const performanceTestQueries = []

      for (let i = 0; i < 10; i++) {
        performanceTestQueries.push(
          supabase.rpc('get_child_items', { parent_item_id: steakDinnerId })
        )
      }

      const startTime = Date.now()
      const results = await Promise.all(performanceTestQueries)
      const endTime = Date.now()

      // Multiple concurrent queries should complete reasonably fast
      expect(endTime - startTime).toBeLessThan(500)

      // All should return same consistent data
      for (const result of results) {
        expect(result.data).toHaveLength(5)
      }
    })
  })
})