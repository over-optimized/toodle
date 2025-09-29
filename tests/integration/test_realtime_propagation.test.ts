import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for real-time collaboration during propagation
// Tests Quickstart Scenario 7: Real-time Collaboration
// This test MUST fail initially (TDD requirement)

describe('Real-time Collaboration during Status Propagation Integration', () => {
  let testUserId1: string
  let testUserId2: string
  let mealListId: string
  let groceryListId: string
  let steakDinnerId: string
  let steakId: string
  let potatoesId: string

  beforeEach(async () => {
    // Setup test data for multi-user scenario
    testUserId1 = uuidv4()
    testUserId2 = uuidv4()
    mealListId = uuidv4()
    groceryListId = uuidv4()
    steakDinnerId = uuidv4()
    steakId = uuidv4()
    potatoesId = uuidv4()

    // Create test users
    await supabase.from('users').insert([
      {
        id: testUserId1,
        email: 'user1@example.com'
      },
      {
        id: testUserId2,
        email: 'user2@example.com'
      }
    ])

    // Create shared lists (User 1 owns, User 2 has access via sharing)
    await supabase.from('lists').insert([
      {
        id: mealListId,
        user_id: testUserId1,
        title: 'Shared Meal Planning',
        type: 'simple'
      },
      {
        id: groceryListId,
        user_id: testUserId1,
        title: 'Shared Shopping',
        type: 'grocery'
      }
    ])

    // Create items with parent-child relationships
    await supabase.from('items').insert([
      {
        id: steakDinnerId,
        list_id: mealListId,
        content: 'Collaborative Meal',
        is_completed: true, // Start completed
        position: 1,
        completed_at: new Date().toISOString(),
        linked_items: {
          children: [steakId, potatoesId]
        }
      },
      {
        id: steakId,
        list_id: groceryListId,
        content: 'Steak',
        is_completed: true, // Start completed
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
        is_completed: false, // Start todo
        position: 2,
        linked_items: {
          parents: [steakDinnerId]
        }
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, steakId, potatoesId])
    await supabase.from('lists').delete().in('id', [mealListId, groceryListId])
    await supabase.from('users').delete().in('id', [testUserId1, testUserId2])
  })

  describe('Multi-User Status Propagation', () => {
    it('should propagate status changes to all connected users', async () => {
      // Simulate User A making a change that triggers propagation
      const beforePropagation = Date.now()

      // **Key Action**: User A moves parent to todo (should propagate to completed children)
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Give propagation time to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // **Verification**: Both users should see the propagated changes
      const { data: finalStates } = await supabase
        .from('items')
        .select('id, is_completed, updated_at')
        .in('id', [steakDinnerId, steakId, potatoesId])

      const parent = finalStates?.find(i => i.id === steakDinnerId)
      const steak = finalStates?.find(i => i.id === steakId)
      const potatoes = finalStates?.find(i => i.id === potatoesId)

      // Verify propagation occurred
      expect(parent?.is_completed).toBe(false) // User's change
      expect(steak?.is_completed).toBe(false) // Propagated from completed
      expect(potatoes?.is_completed).toBe(false) // Unchanged (was already todo)

      // Verify timestamps indicate real-time updates
      const afterPropagation = Date.now()
      const parentUpdateTime = new Date(parent?.updated_at || 0).getTime()
      const steakUpdateTime = new Date(steak?.updated_at || 0).getTime()

      expect(parentUpdateTime).toBeGreaterThan(beforePropagation)
      expect(parentUpdateTime).toBeLessThan(afterPropagation)
      expect(steakUpdateTime).toBeGreaterThan(beforePropagation)
      expect(steakUpdateTime).toBeLessThan(afterPropagation)
    })

    it('should handle concurrent status changes from multiple users', async () => {
      // Create scenario for concurrent changes
      const additionalParentId = uuidv4()
      await supabase.from('items').insert({
        id: additionalParentId,
        list_id: mealListId,
        content: 'Another Meal',
        is_completed: true,
        position: 2,
        completed_at: new Date().toISOString(),
        linked_items: {
          children: [steakId] // Steak now has 2 parents
        }
      })

      // Update steak to have multiple parents
      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [steakDinnerId, additionalParentId]
          }
        })
        .eq('id', steakId)

      // **Key Action**: Both users make concurrent changes
      const concurrentChanges = [
        // User A changes first parent
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', steakDinnerId),

        // User B changes second parent simultaneously
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', additionalParentId)
      ]

      const results = await Promise.all(concurrentChanges)

      // Both changes should succeed
      expect(results[0].error).toBeNull()
      expect(results[1].error).toBeNull()

      // Verify final consistent state
      const { data: finalStates } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, additionalParentId, steakId])

      const parent1 = finalStates?.find(i => i.id === steakDinnerId)
      const parent2 = finalStates?.find(i => i.id === additionalParentId)
      const sharedChild = finalStates?.find(i => i.id === steakId)

      expect(parent1?.is_completed).toBe(false)
      expect(parent2?.is_completed).toBe(false)
      expect(sharedChild?.is_completed).toBe(false) // Propagated (no duplicate actions)

      // Cleanup
      await supabase.from('items').delete().eq('id', additionalParentId)
    })

    it('should maintain propagation consistency with offline sync scenarios', async () => {
      // Simulate offline scenario: User makes change locally first
      const offlineTimestamp = new Date().toISOString()

      // User's "offline" change (simulate pending sync)
      const localChange = {
        id: steakDinnerId,
        is_completed: false,
        completed_at: null,
        updated_at: offlineTimestamp
      }

      // When user comes back online, change is synced
      await supabase
        .from('items')
        .update({
          is_completed: localChange.is_completed,
          completed_at: localChange.completed_at
        })
        .eq('id', steakDinnerId)

      // Verify propagation occurs even with "old" changes
      await new Promise(resolve => setTimeout(resolve, 100))

      const { data: syncedStates } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, steakId, potatoesId])

      const parent = syncedStates?.find(i => i.id === steakDinnerId)
      const steak = syncedStates?.find(i => i.id === steakId)

      expect(parent?.is_completed).toBe(false) // Synced change
      expect(steak?.is_completed).toBe(false) // Propagated after sync
    })
  })

  describe('Real-time Link Creation and Propagation', () => {
    it('should handle concurrent link creation with status propagation', async () => {
      // Reset to known state
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString()
        })
        .in('id', [steakDinnerId, steakId, potatoesId])

      // Create new item for concurrent linking
      const newChildId = uuidv4()
      await supabase.from('items').insert({
        id: newChildId,
        list_id: groceryListId,
        content: 'New Child Item',
        is_completed: true,
        position: 3
      })

      // **Concurrent Actions**: User A creates new link, User B triggers propagation
      const concurrentActions = [
        // User A: Create new parent-child link
        supabase.rpc('create_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_ids: [newChildId]
        }),

        // User B: Trigger status propagation simultaneously
        new Promise(resolve => {
          setTimeout(async () => {
            await supabase
              .from('items')
              .update({
                is_completed: false,
                completed_at: null
              })
              .eq('id', steakDinnerId)
            resolve(null)
          }, 50) // Small delay to create race condition
        })
      ]

      const results = await Promise.all(concurrentActions)

      // Link creation should succeed
      expect(results[0]).toBeDefined()
      if (results[0] && typeof results[0] === 'object' && 'data' in results[0]) {
        expect((results[0] as any).data?.success).toBe(true)
      }

      // Verify final state is consistent
      const { data: finalStates } = await supabase
        .from('items')
        .select('id, is_completed, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId, newChildId])

      const parent = finalStates?.find(i => i.id === steakDinnerId)
      const newChild = finalStates?.find(i => i.id === newChildId)

      // Parent should have new child linked
      expect(parent?.linked_items?.children).toContain(newChildId)

      // New child should be propagated to todo if link was created before propagation
      expect(newChild?.is_completed).toBe(false)

      // Cleanup
      await supabase.from('items').delete().eq('id', newChildId)
    })

    it('should broadcast link changes to all connected users', async () => {
      // User A removes a link
      const removeResult = await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      expect(removeResult.data?.success).toBe(true)

      // Simulate real-time notification: Both users should see updated link state
      const { data: updatedStates } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, steakId])

      const parent = updatedStates?.find(i => i.id === steakDinnerId)
      const child = updatedStates?.find(i => i.id === steakId)

      // Both users should see the link removal
      expect(parent?.linked_items?.children || []).not.toContain(steakId)
      expect(child?.linked_items?.parents || []).not.toContain(steakDinnerId)

      // Other relationships should remain intact
      expect(parent?.linked_items?.children).toContain(potatoesId)
    })
  })

  describe('Conflict Resolution during Real-time Updates', () => {
    it('should handle last-write-wins for status conflicts with propagation', async () => {
      // Setup: Both users have different views initially
      const initialTimestamp = new Date().toISOString()

      // User A's change (earlier timestamp)
      const userAChange = new Date(Date.now() - 1000).toISOString()
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null,
          updated_at: userAChange
        })
        .eq('id', steakDinnerId)

      await new Promise(resolve => setTimeout(resolve, 50))

      // User B's change (later timestamp) - should win
      const userBChange = new Date().toISOString()
      await supabase
        .from('items')
        .update({
          is_completed: true,
          completed_at: userBChange,
          updated_at: userBChange
        })
        .eq('id', steakDinnerId)

      // Verify last-write-wins
      const { data: finalState } = await supabase
        .from('items')
        .select('id, is_completed, updated_at')
        .eq('id', steakDinnerId)
        .single()

      expect(finalState?.is_completed).toBe(true) // User B's change won
      expect(new Date(finalState?.updated_at || 0).getTime())
        .toBeGreaterThan(new Date(userAChange).getTime())
    })

    it('should maintain referential integrity during concurrent link modifications', async () => {
      // Create additional relationships for testing
      const additionalChildId = uuidv4()
      await supabase.from('items').insert({
        id: additionalChildId,
        list_id: groceryListId,
        content: 'Additional Child',
        is_completed: false,
        position: 4
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [additionalChildId]
      })

      // **Concurrent Actions**: Multiple users modify links simultaneously
      const concurrentLinkActions = [
        // User A: Remove one link
        supabase.rpc('remove_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_id: steakId
        }),

        // User B: Add another link
        supabase.rpc('create_parent_child_link', {
          parent_item_id: steakDinnerId,
          child_item_ids: [potatoesId] // Try to re-add existing (should be idempotent)
        }),

        // User C: Trigger status propagation
        supabase
          .from('items')
          .update({
            is_completed: false,
            completed_at: null
          })
          .eq('id', steakDinnerId)
      ]

      const results = await Promise.all(concurrentLinkActions)

      // All operations should complete without errors
      expect(results[0].error).toBeNull() // Remove
      expect(results[1].error).toBeNull() // Add (idempotent)
      expect(results[2].error).toBeNull() // Status change

      // Verify final state maintains integrity
      const { data: finalItems } = await supabase
        .from('items')
        .select('id, linked_items, is_completed')
        .in('id', [steakDinnerId, steakId, potatoesId, additionalChildId])

      const parent = finalItems?.find(i => i.id === steakDinnerId)
      const steak = finalItems?.find(i => i.id === steakId)
      const potatoes = finalItems?.find(i => i.id === potatoesId)
      const additional = finalItems?.find(i => i.id === additionalChildId)

      // Parent should have correct children after concurrent modifications
      expect(parent?.linked_items?.children).not.toContain(steakId) // Removed
      expect(parent?.linked_items?.children).toContain(potatoesId) // Preserved
      expect(parent?.linked_items?.children).toContain(additionalChildId) // Preserved

      // Bidirectional consistency maintained
      expect(steak?.linked_items?.parents || []).not.toContain(steakDinnerId)
      expect(potatoes?.linked_items?.parents).toContain(steakDinnerId)
      expect(additional?.linked_items?.parents).toContain(steakDinnerId)

      // Status propagation should have occurred for remaining children
      expect(parent?.is_completed).toBe(false)
      expect(potatoes?.is_completed).toBe(false) // Propagated
      expect(additional?.is_completed).toBe(false) // Propagated
      expect(steak?.is_completed).toBe(true) // Unlinked, no propagation

      // Cleanup
      await supabase.from('items').delete().eq('id', additionalChildId)
    })
  })

  describe('Real-time Notification Scenarios', () => {
    it('should provide appropriate data for real-time UI updates', async () => {
      // Simulate the data that would be sent via WebSocket notifications
      const beforeChange = await supabase
        .from('items')
        .select('id, is_completed, updated_at, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId])

      // User makes change
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      await new Promise(resolve => setTimeout(resolve, 100))

      const afterChange = await supabase
        .from('items')
        .select('id, is_completed, updated_at, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId])

      // Calculate what changed (this would be done by real-time system)
      const changes = afterChange.data?.map(after => {
        const before = beforeChange.data?.find(b => b.id === after.id)
        return {
          id: after.id,
          changed: before?.is_completed !== after.is_completed ||
                  before?.updated_at !== after.updated_at,
          type: after.id === steakDinnerId ? 'user_action' : 'propagated',
          oldStatus: before?.is_completed,
          newStatus: after.is_completed
        }
      }) || []

      // Verify UI has necessary information for updates
      const userChange = changes.find(c => c.type === 'user_action')
      const propagatedChanges = changes.filter(c => c.type === 'propagated')

      expect(userChange?.changed).toBe(true)
      expect(userChange?.oldStatus).toBe(true)
      expect(userChange?.newStatus).toBe(false)

      expect(propagatedChanges.length).toBeGreaterThan(0)
      for (const propagated of propagatedChanges) {
        expect(propagated.changed).toBe(true)
        expect(propagated.oldStatus).toBe(true)
        expect(propagated.newStatus).toBe(false)
      }
    })

    it('should handle notification ordering for dependent updates', async () => {
      // In real-time systems, update order matters for UI consistency
      const updateSequence: Array<{timestamp: number, type: string, itemId: string}> = []

      // Simulate status change with propagation
      const startTime = Date.now()

      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      // Record when each item was updated
      const { data: updatedItems } = await supabase
        .from('items')
        .select('id, updated_at')
        .in('id', [steakDinnerId, steakId, potatoesId])
        .order('updated_at', { ascending: true })

      // Verify parent was updated first, then children
      // (This ensures UI can show parent change immediately, then propagated changes)
      expect(updatedItems?.[0]?.id).toBe(steakDinnerId) // Parent updated first

      // All updates should be very close in time (real-time)
      const updateTimes = updatedItems?.map(item => new Date(item.updated_at).getTime()) || []
      const maxTimeSpread = Math.max(...updateTimes) - Math.min(...updateTimes)
      expect(maxTimeSpread).toBeLessThan(1000) // Updates within 1 second
    })
  })

  describe('Performance under Real-time Load', () => {
    it('should maintain performance during high-frequency updates', async () => {
      // Simulate multiple rapid status changes (realistic user behavior)
      const rapidChanges = []
      for (let i = 0; i < 5; i++) {
        rapidChanges.push(
          supabase
            .from('items')
            .update({
              is_completed: i % 2 === 0,
              completed_at: i % 2 === 0 ? new Date().toISOString() : null
            })
            .eq('id', steakDinnerId)
        )
      }

      const startTime = Date.now()
      await Promise.all(rapidChanges)
      const endTime = Date.now()

      // Should handle rapid changes efficiently
      expect(endTime - startTime).toBeLessThan(1000)

      // Final state should be consistent
      const { data: finalState } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [steakDinnerId, steakId, potatoesId])

      // All items should have consistent state (no partial updates)
      expect(finalState).toHaveLength(3)
      for (const item of finalState || []) {
        expect(typeof item.is_completed).toBe('boolean')
      }
    })

    it('should handle real-time updates with large link hierarchies efficiently', async () => {
      // Create larger hierarchy for performance testing
      const manyChildren = []
      const insertPromises = []

      for (let i = 0; i < 8; i++) {
        const childId = uuidv4()
        manyChildren.push(childId)
        insertPromises.push(
          supabase.from('items').insert({
            id: childId,
            list_id: groceryListId,
            content: `Child ${i}`,
            is_completed: true,
            position: i + 10,
            completed_at: new Date().toISOString()
          })
        )
      }

      await Promise.all(insertPromises)

      // Link all to parent
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: manyChildren
      })

      // Update children to have parent reference
      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [steakDinnerId]
          }
        })
        .in('id', manyChildren)

      const performanceStart = Date.now()

      // Trigger propagation with many children
      await supabase
        .from('items')
        .update({
          is_completed: false,
          completed_at: null
        })
        .eq('id', steakDinnerId)

      const performanceEnd = Date.now()
      const propagationTime = performanceEnd - performanceStart

      // Should complete within performance target
      expect(propagationTime).toBeLessThan(200) // <100ms target from quickstart, allow margin

      // Verify all children were propagated
      const { data: propagatedChildren } = await supabase
        .from('items')
        .select('is_completed')
        .in('id', manyChildren)

      for (const child of propagatedChildren || []) {
        expect(child.is_completed).toBe(false)
      }

      // Cleanup
      await supabase.from('items').delete().in('id', manyChildren)
    })
  })
})