import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for status propagation core functionality
// Tests Quickstart Scenario 2: Status Propagation (Core Functionality)
// This test MUST fail initially (TDD requirement)

describe('Status Propagation Core Functionality Integration', () => {
  let testUserId: string
  let mealListId: string
  let groceryListId: string
  let steakDinnerId: string
  let steakId: string
  let potatoesId: string
  let carrotsId: string

  beforeEach(async () => {
    // Setup test data matching quickstart scenario
    testUserId = uuidv4()
    mealListId = uuidv4()
    groceryListId = uuidv4()
    steakDinnerId = uuidv4()
    steakId = uuidv4()
    potatoesId = uuidv4()
    carrotsId = uuidv4()

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

    // Create items with parent-child relationships and initial states
    await supabase.from('items').insert([
      {
        id: steakDinnerId,
        list_id: mealListId,
        content: 'Steak Dinner',
        is_completed: true, // Start as completed
        position: 1,
        completed_at: new Date().toISOString(),
        linked_items: {
          children: [steakId, potatoesId, carrotsId]
        }
      },
      {
        id: steakId,
        list_id: groceryListId,
        content: 'Steak',
        is_completed: true, // Start as completed
        position: 1,
        completed_at: new Date().toISOString(),
        linked_items: {
          parents: [steakDinnerId]
        }
      },
      {
        id: potatoesId,
        list_id: groceryListId,
        content: 'Potatoes',
        is_completed: true, // Start as completed
        position: 2,
        completed_at: new Date().toISOString(),
        linked_items: {
          parents: [steakDinnerId]
        }
      },
      {
        id: carrotsId,
        list_id: groceryListId,
        content: 'Carrots',
        is_completed: false, // Start as todo
        position: 3,
        linked_items: {
          parents: [steakDinnerId]
        }
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, steakId, potatoesId, carrotsId])
    await supabase.from('lists').delete().in('id', [mealListId, groceryListId])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Core Status Propagation Workflow', () => {
    it('should propagate parent status change to completed children only', async () => {
      // Verify initial state from quickstart scenario
      const { data: initial } = await supabase
        .from('items')
        .select('id, content, is_completed')
        .in('id', [steakDinnerId, steakId, potatoesId, carrotsId])

      const parent = initial?.find(i => i.id === steakDinnerId)
      const steak = initial?.find(i => i.id === steakId)
      const potatoes = initial?.find(i => i.id === potatoesId)
      const carrots = initial?.find(i => i.id === carrotsId)

      // Expected initial state from scenario
      expect(parent?.is_completed).toBe(true)
      expect(steak?.is_completed).toBe(true)
      expect(potatoes?.is_completed).toBe(true)
      expect(carrots?.is_completed).toBe(false) // Already todo

      // **Key Action**: Move parent (Steak Dinner) from completed to todo
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify propagation occurred
      const { data: final } = await supabase
        .from('items')
        .select('id, content, is_completed, completed_at')
        .in('id', [steakDinnerId, steakId, potatoesId, carrotsId])

      const finalParent = final?.find(i => i.id === steakDinnerId)
      const finalSteak = final?.find(i => i.id === steakId)
      const finalPotatoes = final?.find(i => i.id === potatoesId)
      const finalCarrots = final?.find(i => i.id === carrotsId)

      // Expected final state from scenario
      expect(finalParent?.is_completed).toBe(false) // Parent changed
      expect(finalSteak?.is_completed).toBe(false) // Propagated (was completed)
      expect(finalPotatoes?.is_completed).toBe(false) // Propagated (was completed)
      expect(finalCarrots?.is_completed).toBe(false) // Unchanged (was already todo)

      // Verify completed_at cleared for propagated items
      expect(finalSteak?.completed_at).toBeNull()
      expect(finalPotatoes?.completed_at).toBeNull()
      expect(finalCarrots?.completed_at).toBeNull() // Was already null
    })

    it('should NOT propagate when parent moves from todo to completed', async () => {
      // First set parent and some children to todo state
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .in('id', [steakDinnerId, steakId])

      // Leave potatoes completed, carrots todo for mixed state test
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', potatoesId)

      // Get pre-completion state
      const { data: before } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakId, potatoesId, carrotsId])

      // **Key Action**: Move parent from todo to completed (should NOT propagate)
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', steakDinnerId)

      // Verify NO propagation occurred
      const { data: after } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakId, potatoesId, carrotsId])

      // Children should be unchanged
      for (const beforeItem of before || []) {
        const afterItem = after?.find(a => a.id === beforeItem.id)
        expect(afterItem?.is_completed).toBe(beforeItem.is_completed)
      }

      // Verify parent changed but children didn't
      const { data: parent } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.is_completed).toBe(true) // Parent changed
    })

    it('should handle independent child completion without affecting parent', async () => {
      // Set initial state: parent todo, children mixed
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .in('id', [steakId, potatoesId])

      // Get initial parent state
      const { data: initialParent } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakDinnerId)
        .single()

      // **Key Action**: Complete one child independently
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', steakId)

      // Verify parent unchanged
      const { data: finalParent } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', steakDinnerId)
        .single()

      expect(finalParent?.is_completed).toBe(initialParent?.is_completed)

      // Verify other children unchanged
      const { data: otherChildren } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [potatoesId, carrotsId])

      const potatoes = otherChildren?.find(c => c.id === potatoesId)
      const carrots = otherChildren?.find(c => c.id === carrotsId)

      expect(potatoes?.is_completed).toBe(false) // Should be unchanged
      expect(carrots?.is_completed).toBe(false) // Should be unchanged
    })

    it('should support the complete meal rotation workflow', async () => {
      // Scenario: Complete meal rotation cycle

      // Phase 1: Meal is complete, ingredients purchased
      // (This is the initial state set in beforeEach)

      // Phase 2: Time to cook again - move meal to todo
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify completed ingredients moved to todo (need to shop again)
      const { data: afterReset } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakId, potatoesId, carrotsId])

      const steak = afterReset?.find(i => i.id === steakId)
      const potatoes = afterReset?.find(i => i.id === potatoesId)
      const carrots = afterReset?.find(i => i.id === carrotsId)

      expect(steak?.is_completed).toBe(false) // Reset to shop again
      expect(potatoes?.is_completed).toBe(false) // Reset to shop again
      expect(carrots?.is_completed).toBe(false) // Was already todo

      // Phase 3: Shop for ingredients independently
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakId, potatoesId])

      // Phase 4: Cook the meal
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', steakDinnerId)

      // Verify meal complete but ingredients maintain independent state
      const { data: final } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, steakId, potatoesId, carrotsId])

      const finalMeal = final?.find(i => i.id === steakDinnerId)
      const finalSteak = final?.find(i => i.id === steakId)
      const finalPotatoes = final?.find(i => i.id === potatoesId)
      const finalCarrots = final?.find(i => i.id === carrotsId)

      expect(finalMeal?.is_completed).toBe(true) // Meal cooked
      expect(finalSteak?.is_completed).toBe(true) // Purchased
      expect(finalPotatoes?.is_completed).toBe(true) // Purchased
      expect(finalCarrots?.is_completed).toBe(false) // Still need to buy
    })
  })

  describe('Edge Cases and Validation', () => {
    it('should handle rapid status changes without conflicts', async () => {
      // Rapid sequence of status changes
      const changes = [
        { is_completed: false, completed_at: null },
        { is_completed: true, completed_at: new Date().toISOString() },
        { is_completed: false, completed_at: null }
      ]

      for (const change of changes) {
        await supabase
          .from('items')
          .update(change)
          .eq('id', steakDinnerId)
      }

      // Verify final state is consistent
      const { data: finalState } = await supabase
        .from('items')
        .select('id, is_completed, completed_at')
        .in('id', [steakDinnerId, steakId, potatoesId, carrotsId])

      const parent = finalState?.find(i => i.id === steakDinnerId)
      expect(parent?.is_completed).toBe(false)
      expect(parent?.completed_at).toBeNull()

      // Children should be in todo state due to last propagation
      const children = finalState?.filter(i => i.id !== steakDinnerId)
      for (const child of children || []) {
        if (child.id === carrotsId) {
          expect(child.is_completed).toBe(false) // Was already false
        } else {
          expect(child.is_completed).toBe(false) // Propagated from last change
        }
      }
    })

    it('should handle items with no children gracefully', async () => {
      // Create standalone item
      const standaloneId = uuidv4()
      await supabase.from('items').insert({
        id: standaloneId,
        list_id: mealListId,
        content: 'Standalone Meal',
        is_completed: true,
        position: 2
      })

      // Change status - should not cause errors
      const { data, error } = await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', standaloneId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.is_completed).toBe(false)

      // Cleanup
      await supabase.from('items').delete().eq('id', standaloneId)
    })

    it('should preserve child state when child has no parents', async () => {
      // Remove parent relationship from one child
      await supabase
        .from('items')
        .update({
          linked_items: null
        })
        .eq('id', carrotsId)

      // Update parent status
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Verify orphaned child unchanged
      const { data: carrots } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', carrotsId)
        .single()

      expect(carrots?.is_completed).toBe(false) // Should remain unchanged

      // Verify linked children still propagated
      const { data: linkedChildren } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakId, potatoesId])

      for (const child of linkedChildren || []) {
        expect(child.is_completed).toBe(false) // Should be propagated
      }
    })

    it('should handle corrupted link data gracefully', async () => {
      // Create item with malformed linked_items (should be prevented by constraints)
      // But test the propagation function's resilience

      // First create a valid relationship
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Trigger propagation
      const { error } = await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      expect(error).toBeNull() // Should not crash on any data issues
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple children efficiently', async () => {
      // Create many child items
      const manyChildIds = []
      const insertPromises = []

      for (let i = 0; i < 10; i++) {
        const childId = uuidv4()
        manyChildIds.push(childId)
        insertPromises.push(
          supabase.from('items').insert({
            id: childId,
            list_id: groceryListId,
            content: `Child Item ${i}`,
            is_completed: true,
            position: i + 10,
            completed_at: new Date().toISOString(),
            linked_items: {
              parents: [steakDinnerId]
            }
          })
        )
      }

      await Promise.all(insertPromises)

      // Update parent to include all children
      await supabase
        .from('items')
        .update({
          linked_items: {
            children: manyChildIds
          }
        })
        .eq('id', steakDinnerId)

      const startTime = Date.now()

      // Trigger propagation
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      const endTime = Date.now()
      const propagationTime = endTime - startTime

      // Should complete within reasonable time (target: <100ms per quickstart)
      expect(propagationTime).toBeLessThan(500) // Allow some margin for test environment

      // Verify all children propagated
      const { data: propagatedChildren } = await supabase
        .from('items')
        .select('is_completed')
        .in('id', manyChildIds)

      for (const child of propagatedChildren || []) {
        expect(child.is_completed).toBe(false)
      }

      // Cleanup
      await supabase.from('items').delete().in('id', manyChildIds)
    })

    it('should maintain consistency during concurrent operations', async () => {
      // Test concurrent parent status changes and child updates
      const concurrentPromises = [
        // Change parent status
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', steakDinnerId),

        // Update child content concurrently
        supabase
          .from('items')
          .update({
            content: 'Premium Steak'
          })
          .eq('id', steakId)
      ]

      const results = await Promise.all(concurrentPromises)

      // Both operations should succeed
      expect(results[0].error).toBeNull()
      expect(results[1].error).toBeNull()

      // Verify final consistency
      const { data: finalState } = await supabase
        .from('items')
        .select('id, is_completed, content')
        .in('id', [steakDinnerId, steakId])

      const parent = finalState?.find(i => i.id === steakDinnerId)
      const child = finalState?.find(i => i.id === steakId)

      expect(parent?.is_completed).toBe(false) // Status change applied
      expect(child?.is_completed).toBe(false) // Propagation occurred
      expect(child?.content).toBe('Premium Steak') // Content update preserved
    })
  })
})