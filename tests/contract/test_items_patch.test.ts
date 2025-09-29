import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Contract test for enhanced items PATCH endpoint with status propagation
// This test MUST fail initially (TDD requirement)

describe('Enhanced Items PATCH Contract', () => {
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

    // Create parent item with children
    await supabase.from('items').insert({
      id: parentItemId,
      list_id: testListId1,
      content: 'Steak Dinner',
      is_completed: true, // Start completed
      position: 1,
      linked_items: {
        children: [childItem1Id, childItem2Id]
      }
    })

    // Create child items
    await supabase.from('items').insert([
      {
        id: childItem1Id,
        list_id: testListId2,
        content: 'Steak',
        is_completed: true, // Start completed
        position: 1,
        linked_items: {
          parents: [parentItemId]
        }
      },
      {
        id: childItem2Id,
        list_id: testListId2,
        content: 'Potatoes',
        is_completed: false, // Start todo
        position: 2,
        linked_items: {
          parents: [parentItemId]
        }
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [parentItemId, childItem1Id, childItem2Id])
    await supabase.from('lists').delete().in('id', [testListId1, testListId2])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Standard PATCH Request/Response Contract', () => {
    it('should accept standard item update fields', async () => {
      const { data, error } = await supabase
        .from('items')
        .update({
          content: 'Updated Content',
          is_completed: false,
          target_date: '2024-12-25',
          position: 2
        })
        .eq('id', parentItemId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.content).toBe('Updated Content')
    })

    it('should accept linked_items updates', async () => {
      const newLinkedItems = {
        children: [childItem1Id],
        parents: [],
        bidirectional: []
      }

      const { data, error } = await supabase
        .from('items')
        .update({
          linked_items: newLinkedItems
        })
        .eq('id', parentItemId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.linked_items).toEqual(newLinkedItems)
    })

    it('should update timestamps correctly', async () => {
      const beforeUpdate = new Date()

      const { data: beforeItem } = await supabase
        .from('items')
        .select('updated_at, completed_at')
        .eq('id', childItem1Id)
        .single()

      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', childItem1Id)

      const { data: afterItem } = await supabase
        .from('items')
        .select('updated_at, completed_at')
        .eq('id', childItem1Id)
        .single()

      // updated_at should change
      expect(new Date(afterItem.updated_at)).toBeAfter(new Date(beforeItem.updated_at))

      // completed_at should be null when uncompleted
      expect(afterItem.completed_at).toBeNull()
    })

    it('should set completed_at when marking item complete', async () => {
      const beforeUpdate = new Date()

      await supabase
        .from('items')
        .update({
          is_completed: true
        })
        .eq('id', childItem2Id) // Was false

      const { data } = await supabase
        .from('items')
        .select('completed_at, is_completed')
        .eq('id', childItem2Id)
        .single()

      expect(data.is_completed).toBe(true)
      expect(data.completed_at).not.toBeNull()
      expect(new Date(data.completed_at)).toBeAfter(beforeUpdate)
    })

    it('should handle partial updates', async () => {
      const { data: before } = await supabase
        .from('items')
        .select('content, is_completed, position')
        .eq('id', parentItemId)
        .single()

      // Update only content
      await supabase
        .from('items')
        .update({
          content: 'Only Content Changed'
        })
        .eq('id', parentItemId)

      const { data: after } = await supabase
        .from('items')
        .select('content, is_completed, position')
        .eq('id', parentItemId)
        .single()

      expect(after.content).toBe('Only Content Changed')
      expect(after.is_completed).toBe(before.is_completed) // Unchanged
      expect(after.position).toBe(before.position) // Unchanged
    })
  })

  describe('Status Propagation Contract', () => {
    it('should trigger status propagation when parent moves to todo', async () => {
      // Verify initial state: parent completed, child1 completed, child2 todo
      const { data: initial } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [parentItemId, childItem1Id, childItem2Id])

      const parent = initial.find(i => i.id === parentItemId)
      const child1 = initial.find(i => i.id === childItem1Id)
      const child2 = initial.find(i => i.id === childItem2Id)

      expect(parent.is_completed).toBe(true)
      expect(child1.is_completed).toBe(true)
      expect(child2.is_completed).toBe(false)

      // Move parent to todo - should propagate to completed children only
      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', parentItemId)

      // Check final state
      const { data: final } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [parentItemId, childItem1Id, childItem2Id])

      const finalParent = final.find(i => i.id === parentItemId)
      const finalChild1 = final.find(i => i.id === childItem1Id)
      const finalChild2 = final.find(i => i.id === childItem2Id)

      expect(finalParent.is_completed).toBe(false) // Parent changed
      expect(finalChild1.is_completed).toBe(false) // Child1 propagated (was completed)
      expect(finalChild2.is_completed).toBe(false) // Child2 unchanged (was already todo)
    })

    it('should NOT propagate when parent moves to completed', async () => {
      // Start with parent as todo
      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', parentItemId)

      // Set children to different states
      await supabase
        .from('items')
        .update({
          is_completed: true
        })
        .eq('id', childItem1Id)

      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', childItem2Id)

      // Get initial state
      const { data: initial } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [parentItemId, childItem1Id, childItem2Id])

      // Move parent to completed - should NOT propagate
      await supabase
        .from('items')
        .update({
          is_completed: true
        })
        .eq('id', parentItemId)

      // Check final state
      const { data: final } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [parentItemId, childItem1Id, childItem2Id])

      const finalParent = final.find(i => i.id === parentItemId)
      const initialChild1 = initial.find(i => i.id === childItem1Id)
      const finalChild1 = final.find(i => i.id === childItem1Id)
      const initialChild2 = initial.find(i => i.id === childItem2Id)
      const finalChild2 = final.find(i => i.id === childItem2Id)

      expect(finalParent.is_completed).toBe(true) // Parent changed
      expect(finalChild1.is_completed).toBe(initialChild1.is_completed) // Child1 unchanged
      expect(finalChild2.is_completed).toBe(initialChild2.is_completed) // Child2 unchanged
    })

    it('should NOT propagate when child status changes', async () => {
      // Get initial parent state
      const { data: initialParent } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', parentItemId)
        .single()

      // Change child status
      await supabase
        .from('items')
        .update({
          is_completed: !childItem1Id.is_completed // Toggle
        })
        .eq('id', childItem1Id)

      // Check parent unchanged
      const { data: finalParent } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', parentItemId)
        .single()

      expect(finalParent.is_completed).toBe(initialParent.is_completed)
    })

    it('should handle items with no children gracefully', async () => {
      // Create item with no children
      const soloItemId = uuidv4()
      await supabase.from('items').insert({
        id: soloItemId,
        list_id: testListId1,
        content: 'Solo Item',
        is_completed: true,
        position: 3
      })

      // Should update without errors
      const { data, error } = await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', soloItemId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.is_completed).toBe(false)

      // Cleanup
      await supabase.from('items').delete().eq('id', soloItemId)
    })

    it('should handle multiple parent scenarios correctly', async () => {
      // Create second parent for child1
      const secondParentId = uuidv4()
      await supabase.from('items').insert({
        id: secondParentId,
        list_id: testListId1,
        content: 'Second Parent',
        is_completed: true,
        position: 4,
        linked_items: {
          children: [childItem1Id]
        }
      })

      // Update child1 to have multiple parents
      await supabase
        .from('items')
        .update({
          linked_items: {
            parents: [parentItemId, secondParentId]
          }
        })
        .eq('id', childItem1Id)

      // Move first parent to todo
      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', parentItemId)

      // Child should be moved to todo
      const { data: child } = await supabase
        .from('items')
        .select('is_completed')
        .eq('id', childItem1Id)
        .single()

      expect(child.is_completed).toBe(false)

      // Cleanup
      await supabase.from('items').delete().eq('id', secondParentId)
    })

    it('should preserve completed_at and other fields during propagation', async () => {
      // Get initial child1 data
      const { data: initial } = await supabase
        .from('items')
        .select('content, position, target_date, created_at')
        .eq('id', childItem1Id)
        .single()

      // Trigger propagation
      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', parentItemId)

      // Check child1 data preserved except completion fields
      const { data: final } = await supabase
        .from('items')
        .select('content, position, target_date, created_at, is_completed, completed_at')
        .eq('id', childItem1Id)
        .single()

      expect(final.content).toBe(initial.content)
      expect(final.position).toBe(initial.position)
      expect(final.target_date).toBe(initial.target_date)
      expect(final.created_at).toBe(initial.created_at)
      expect(final.is_completed).toBe(false) // Changed
      expect(final.completed_at).toBeNull() // Changed
    })
  })

  describe('Enhanced Response Contract', () => {
    it('should return propagated_updates array when propagation occurs', async () => {
      // This would be tested via a custom RPC or service layer
      // For now, test that the underlying trigger/function works

      // Move parent to todo and verify children changed
      await supabase
        .from('items')
        .update({
          is_completed: false
        })
        .eq('id', parentItemId)

      // Verify propagation occurred by checking final states
      const { data: children } = await supabase
        .from('items')
        .select('id, is_completed')
        .in('id', [childItem1Id, childItem2Id])

      const child1 = children.find(c => c.id === childItem1Id)
      expect(child1.is_completed).toBe(false) // Was propagated from completed
    })

    it('should handle concurrent updates gracefully', async () => {
      // Test concurrent updates to parent and child
      const updatePromises = [
        supabase
          .from('items')
          .update({ is_completed: false })
          .eq('id', parentItemId),
        supabase
          .from('items')
          .update({ content: 'Updated Child' })
          .eq('id', childItem1Id)
      ]

      const results = await Promise.all(updatePromises)

      // Both should succeed
      expect(results[0].error).toBeNull()
      expect(results[1].error).toBeNull()

      // Verify final state is consistent
      const { data: final } = await supabase
        .from('items')
        .select('id, is_completed, content')
        .in('id', [parentItemId, childItem1Id])

      const parent = final.find(i => i.id === parentItemId)
      const child = final.find(i => i.id === childItem1Id)

      expect(parent.is_completed).toBe(false)
      expect(child.content).toBe('Updated Child')
    })

    it('should maintain referential integrity during updates', async () => {
      // Update linked_items and verify both sides stay consistent
      await supabase
        .from('items')
        .update({
          linked_items: {
            children: [childItem1Id] // Remove childItem2Id
          }
        })
        .eq('id', parentItemId)

      // Child2 should still reference parent (this tests validation)
      const { data: child2 } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', childItem2Id)
        .single()

      // The validation should prevent inconsistent state
      expect(child2.linked_items?.parents).toContain(parentItemId)
    })
  })

  describe('Error Handling Contract', () => {
    it('should handle malformed linked_items data', async () => {
      const { data, error } = await supabase
        .from('items')
        .update({
          linked_items: 'invalid-json' // Should be object or array
        })
        .eq('id', parentItemId)

      // Should be rejected by database constraint
      expect(error).not.toBeNull()
    })

    it('should validate maximum content length', async () => {
      const longContent = 'a'.repeat(501) // Over 500 char limit

      const { data, error } = await supabase
        .from('items')
        .update({
          content: longContent
        })
        .eq('id', parentItemId)

      expect(error).not.toBeNull()
    })

    it('should handle non-existent item updates gracefully', async () => {
      const { data, error } = await supabase
        .from('items')
        .update({
          content: 'Updated'
        })
        .eq('id', uuidv4()) // Non-existent ID
        .select()

      expect(error).toBeNull()
      expect(data).toEqual([]) // No rows affected
    })

    it('should preserve data integrity on partial update failures', async () => {
      // Get initial state
      const { data: initial } = await supabase
        .from('items')
        .select('*')
        .eq('id', parentItemId)
        .single()

      // Try update with invalid data
      const { error } = await supabase
        .from('items')
        .update({
          content: 'Valid content',
          position: 'invalid-position' // Should be numeric
        })
        .eq('id', parentItemId)

      expect(error).not.toBeNull()

      // Verify item unchanged
      const { data: final } = await supabase
        .from('items')
        .select('*')
        .eq('id', parentItemId)
        .single()

      expect(final).toEqual(initial)
    })

    it('should handle orphaned references in linked_items', async () => {
      const nonExistentId = uuidv4()

      // This should be caught by the validation trigger
      const { data, error } = await supabase
        .from('items')
        .update({
          linked_items: {
            children: [nonExistentId]
          }
        })
        .eq('id', parentItemId)

      expect(error).not.toBeNull()
      expect(error.message).toContain('Invalid linked item')
    })
  })
})