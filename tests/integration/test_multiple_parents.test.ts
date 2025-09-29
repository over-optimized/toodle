import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for multiple parents scenario
// Tests Quickstart Scenario 3: Multiple Parents
// This test MUST fail initially (TDD requirement)

describe('Multiple Parents Scenario Integration', () => {
  let testUserId: string
  let mealListId: string
  let groceryListId: string
  let steakDinnerId: string
  let beefTacosId: string
  let steakId: string

  beforeEach(async () => {
    // Setup test data matching quickstart scenario
    testUserId = uuidv4()
    mealListId = uuidv4()
    groceryListId = uuidv4()
    steakDinnerId = uuidv4()
    beefTacosId = uuidv4()
    steakId = uuidv4()

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

    // Create initial items as per quickstart scenario
    await supabase.from('items').insert([
      {
        id: steakDinnerId,
        list_id: mealListId,
        content: 'Steak Dinner',
        is_completed: false,
        position: 1,
        linked_items: {
          children: [steakId] // Initial relationship
        }
      },
      {
        id: beefTacosId,
        list_id: mealListId,
        content: 'Beef Tacos',
        is_completed: false,
        position: 2
      },
      {
        id: steakId,
        list_id: groceryListId,
        content: 'Steak',
        is_completed: false,
        position: 1,
        linked_items: {
          parents: [steakDinnerId] // Initially has 1 parent
        }
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, beefTacosId, steakId])
    await supabase.from('lists').delete().in('id', [mealListId, groceryListId])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Multiple Parent Setup and Indicators', () => {
    it('should create second parent relationship and update indicators', async () => {
      // Verify initial state: Steak has 1 parent (Steak Dinner)
      const { data: initialChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(initialChild?.linked_items?.parents).toHaveLength(1)
      expect(initialChild?.linked_items?.parents).toContain(steakDinnerId)

      // **Key Action**: Link "Beef Tacos" to "Steak" (creating second parent)
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      expect(linkResult.data?.success).toBe(true)

      // Verify Steak now shows 2 parents indicator (🔗⬆️2)
      const { data: childAfterLink } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(childAfterLink?.linked_items?.parents).toHaveLength(2)
      expect(childAfterLink?.linked_items?.parents).toContain(steakDinnerId)
      expect(childAfterLink?.linked_items?.parents).toContain(beefTacosId)

      // Verify both parents show 1 child each
      const { data: parents } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, beefTacosId])

      const steakDinner = parents?.find(p => p.id === steakDinnerId)
      const beefTacos = parents?.find(p => p.id === beefTacosId)

      expect(steakDinner?.linked_items?.children).toContain(steakId)
      expect(beefTacos?.linked_items?.children).toContain(steakId)
      expect(steakDinner?.linked_items?.children).toHaveLength(1)
      expect(beefTacos?.linked_items?.children).toHaveLength(1)
    })

    it('should handle visual indicator calculation for multiple parents', async () => {
      // Create the multiple parent relationship
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Get data for UI indicator calculation
      const { data: allItems } = await supabase
        .from('items')
        .select('id, content, linked_items')
        .in('id', [steakDinnerId, beefTacosId, steakId])

      const steak = allItems?.find(i => i.id === steakId)
      const steakDinner = allItems?.find(i => i.id === steakDinnerId)
      const beefTacos = allItems?.find(i => i.id === beefTacosId)

      // Child with multiple parents: should show 🔗⬆️2
      const steakParentsCount = steak?.linked_items?.parents?.length || 0
      const steakChildrenCount = steak?.linked_items?.children?.length || 0
      expect(steakParentsCount).toBe(2)
      expect(steakChildrenCount).toBe(0)

      // Parents should each show 1 child: 🔗⬇️1
      const dinnerChildrenCount = steakDinner?.linked_items?.children?.length || 0
      const tacosChildrenCount = beefTacos?.linked_items?.children?.length || 0
      expect(dinnerChildrenCount).toBe(1)
      expect(tacosChildrenCount).toBe(1)
    })
  })

  describe('Multiple Parent Status Propagation', () => {
    it('should handle propagation from any parent to shared child', async () => {
      // Setup: Create multiple parent relationship and set states
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Set all items to completed
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, beefTacosId, steakId])

      // **Key Action**: Move Steak Dinner to todo (first parent)
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify Steak moves to todo
      const { data: afterFirstPropagation } = await supabase
        .from('items')
        .select('id, is_completed')
        .eq('id', steakId)
        .single()

      expect(afterFirstPropagation?.is_completed).toBe(false) // Propagated from first parent

      // **Additional Action**: Move Beef Tacos to todo (second parent)
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', beefTacosId)

      // Verify Steak remains in todo (no duplicate action)
      const { data: afterSecondPropagation } = await supabase
        .from('items')
        .select('id, is_completed')
        .eq('id', steakId)
        .single()

      expect(afterSecondPropagation?.is_completed).toBe(false) // Still todo, no duplicate change
    })

    it('should handle complex multiple parent propagation sequence', async () => {
      // Create multiple parent setup
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Test sequence from quickstart scenario:
      // 1. Mark both parents and child as completed
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, beefTacosId, steakId])

      // 2. Move first parent (Steak Dinner) to todo
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify Steak propagated to todo
      let { data: steakState } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakId)
        .single()

      expect(steakState?.is_completed).toBe(false)

      // 3. Move second parent (Beef Tacos) to todo
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', beefTacosId)

      // Verify Steak remains in todo (idempotent)
      steakState = (await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakId)
        .single()).data

      expect(steakState?.is_completed).toBe(false)

      // 4. Complete child independently (should not affect parents)
      const { data: initialParents } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, beefTacosId])

      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', steakId)

      // Verify parents unchanged
      const { data: finalParents } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, beefTacosId])

      for (const initialParent of initialParents || []) {
        const finalParent = finalParents?.find(p => p.id === initialParent.id)
        expect(finalParent?.is_completed).toBe(initialParent.is_completed)
      }
    })

    it('should prevent race conditions in multiple parent scenarios', async () => {
      // Create multiple parent setup
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Set all to completed
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, beefTacosId, steakId])

      // **Concurrent Action**: Both parents move to todo simultaneously
      const concurrentUpdates = [
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', steakDinnerId),
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', beefTacosId)
      ]

      const results = await Promise.all(concurrentUpdates)

      // Both updates should succeed
      expect(results[0].error).toBeNull()
      expect(results[1].error).toBeNull()

      // Child should be in consistent state
      const { data: finalChild } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakId)
        .single()

      expect(finalChild?.is_completed).toBe(false) // Propagated correctly

      // Both parents should be todo
      const { data: finalParents } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, beefTacosId])

      for (const parent of finalParents || []) {
        expect(parent.is_completed).toBe(false)
      }
    })
  })

  describe('Multiple Parent Link Management', () => {
    it('should support removing one parent while preserving others', async () => {
      // Create multiple parent setup
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Verify initial state: 2 parents
      const { data: beforeRemoval } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(beforeRemoval?.linked_items?.parents).toHaveLength(2)

      // **Key Action**: Remove one parent relationship
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      // Verify one parent removed, other preserved
      const { data: afterRemoval } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(afterRemoval?.linked_items?.parents).toHaveLength(1)
      expect(afterRemoval?.linked_items?.parents).not.toContain(steakDinnerId)
      expect(afterRemoval?.linked_items?.parents).toContain(beefTacosId)

      // Verify removed parent no longer references child
      const { data: removedParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(removedParent?.linked_items?.children || []).not.toContain(steakId)

      // Verify remaining parent still references child
      const { data: remainingParent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', beefTacosId)
        .single()

      expect(remainingParent?.linked_items?.children).toContain(steakId)
    })

    it('should handle complete removal of all parent relationships', async () => {
      // Create multiple parent setup
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Remove all parent relationships
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_id: steakId
      })

      // Verify child has no parents
      const { data: orphanedChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(orphanedChild?.linked_items?.parents || []).toHaveLength(0)

      // Verify parents have no children
      const { data: formerParents } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, beefTacosId])

      for (const parent of formerParents || []) {
        expect(parent.linked_items?.children || []).not.toContain(steakId)
      }
    })

    it('should provide correct data for UI link management', async () => {
      // Create multiple parent setup
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [steakId]
      })

      // Get parent items for UI display (child perspective)
      const parentItemsResult = await supabase.rpc('get_parent_items', {
        child_item_id: steakId
      })

      expect(parentItemsResult.data).toHaveLength(2)

      const parentItems = parentItemsResult.data || []
      const parentIds = parentItems.map(p => p.id)

      expect(parentIds).toContain(steakDinnerId)
      expect(parentIds).toContain(beefTacosId)

      // Verify UI has necessary information
      for (const parentItem of parentItems) {
        expect(parentItem.content).toBeDefined()
        expect(parentItem.list_title).toBeDefined()
        expect(parentItem.list_type).toBeDefined()
        expect(typeof parentItem.is_completed).toBe('boolean')
      }

      // Get child items for UI display (parent perspective)
      const childrenResult1 = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      const childrenResult2 = await supabase.rpc('get_child_items', {
        parent_item_id: beefTacosId
      })

      expect(childrenResult1.data).toHaveLength(1)
      expect(childrenResult2.data).toHaveLength(1)
      expect(childrenResult1.data?.[0]?.id).toBe(steakId)
      expect(childrenResult2.data?.[0]?.id).toBe(steakId)
    })
  })

  describe('Complex Multiple Parent Scenarios', () => {
    it('should handle child with many parents efficiently', async () => {
      // Create multiple parent items
      const manyParentIds = []
      const insertPromises = []

      for (let i = 0; i < 5; i++) {
        const parentId = uuidv4()
        manyParentIds.push(parentId)
        insertPromises.push(
          supabase.from('items').insert({
            id: parentId,
            list_id: mealListId,
            content: `Parent Meal ${i}`,
            is_completed: false,
            position: i + 10
          })
        )
      }

      await Promise.all(insertPromises)

      // Link all parents to the shared child
      for (const parentId of manyParentIds) {
        await supabase.rpc('create_parent_child_link', {
          parent_item_id: parentId,
          child_item_ids: [steakId]
        })
      }

      // Verify child has all parents (including original)
      const { data: childWithManyParents } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      const totalParents = [steakDinnerId, ...manyParentIds]
      expect(childWithManyParents?.linked_items?.parents).toHaveLength(totalParents.length)

      for (const parentId of totalParents) {
        expect(childWithManyParents?.linked_items?.parents).toContain(parentId)
      }

      // Test propagation performance with many parents
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [...totalParents, steakId])

      const startTime = Date.now()

      // Trigger propagation from one parent
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', manyParentIds[0])

      const endTime = Date.now()

      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(200)

      // Verify propagation occurred
      const { data: propagatedChild } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakId)
        .single()

      expect(propagatedChild?.is_completed).toBe(false)

      // Cleanup
      await supabase.from('items').delete().in('id', manyParentIds)
    })

    it('should maintain referential integrity across complex parent structures', async () => {
      // Create complex multi-level structure
      const intermediateItemId = uuidv4()

      await supabase.from('items').insert({
        id: intermediateItemId,
        list_id: groceryListId,
        content: 'Beef (General)',
        is_completed: false,
        position: 4
      })

      // Create relationships: steakDinnerId -> intermediateItemId -> steakId
      //                      beefTacosId -> intermediateItemId -> steakId
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [intermediateItemId]
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: beefTacosId,
        child_item_ids: [intermediateItemId]
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: intermediateItemId,
        child_item_ids: [steakId]
      })

      // Verify complex structure
      const { data: allItems } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, beefTacosId, intermediateItemId, steakId])

      const intermediate = allItems?.find(i => i.id === intermediateItemId)
      const finalChild = allItems?.find(i => i.id === steakId)

      // Intermediate item should have 2 parents and 1 child
      expect(intermediate?.linked_items?.parents).toHaveLength(2)
      expect(intermediate?.linked_items?.children).toHaveLength(1)

      // Final child should have multiple inheritance paths
      expect(finalChild?.linked_items?.parents).toContain(intermediateItemId)

      // Test propagation through levels
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, beefTacosId, intermediateItemId, steakId])

      // Trigger top-level propagation
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify cascading propagation
      const { data: cascadedItems } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [intermediateItemId, steakId])

      const cascadedIntermediate = cascadedItems?.find(i => i.id === intermediateItemId)
      const cascadedChild = cascadedItems?.find(i => i.id === steakId)

      expect(cascadedIntermediate?.is_completed).toBe(false) // First level propagation
      expect(cascadedChild?.is_completed).toBe(false) // Second level propagation

      // Cleanup
      await supabase.from('items').delete().eq('id', intermediateItemId)
    })
  })
})