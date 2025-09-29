import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for circular dependency prevention
// Tests Quickstart Scenario 4: Circular Dependency Prevention
// This test MUST fail initially (TDD requirement)

describe('Circular Dependency Prevention Integration', () => {
  let testUserId: string
  let testListId: string
  let steakDinnerId: string
  let steakId: string
  let onionsId: string
  let groundBeefId: string

  beforeEach(async () => {
    // Setup test data matching quickstart scenario
    testUserId = uuidv4()
    testListId = uuidv4()
    steakDinnerId = uuidv4()
    steakId = uuidv4()
    onionsId = uuidv4()
    groundBeefId = uuidv4()

    // Create test user
    await supabase.from('users').insert({
      id: testUserId,
      email: 'test@example.com'
    })

    // Create lists
    await supabase.from('lists').insert({
      id: testListId,
      user_id: testUserId,
      title: 'Mixed List',
      type: 'simple'
    })

    // Create items for circular dependency testing
    await supabase.from('items').insert([
      {
        id: steakDinnerId,
        list_id: testListId,
        content: 'Steak Dinner',
        is_completed: false,
        position: 1
      },
      {
        id: steakId,
        list_id: testListId,
        content: 'Steak',
        is_completed: false,
        position: 2
      },
      {
        id: onionsId,
        list_id: testListId,
        content: 'Onions',
        is_completed: false,
        position: 3
      },
      {
        id: groundBeefId,
        list_id: testListId,
        content: 'Ground Beef',
        is_completed: false,
        position: 4
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, steakId, onionsId, groundBeefId])
    await supabase.from('lists').delete().eq('id', testListId)
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Direct Circular Dependency Prevention', () => {
    it('should prevent simple A→B when B→A already exists', async () => {
      // Step 1: Create initial relationship Steak Dinner → Steak
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Verify initial relationship exists
      const { data: initialChild } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(initialChild?.linked_items?.parents).toContain(steakDinnerId)

      // **Key Action**: Try to create reverse relationship Steak → Steak Dinner (should fail)
      const reverseAttempt = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      expect(reverseAttempt.data?.can_link).toBe(false)

      const circularError = reverseAttempt.data?.invalid_links?.find(
        (link: any) => link.child_id === steakDinnerId
      )
      expect(circularError?.reason).toBe('circular_dependency')

      // Verify actual link creation is blocked
      const actualLinkAttempt = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      expect(actualLinkAttempt.data?.success).toBe(true) // Function succeeds
      expect(actualLinkAttempt.data?.links_created).toBe(0) // But no links created
      expect(actualLinkAttempt.data?.warnings).toContain('Cannot create circular dependency')

      // Verify no reverse relationship was created
      const { data: noReverse } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(noReverse?.linked_items?.parents || []).not.toContain(steakId)
    })

    it('should detect and prevent self-linking attempts', async () => {
      // **Key Action**: Try to link item to itself
      const selfLinkValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakDinnerId]
      })

      expect(selfLinkValidation.data?.can_link).toBe(false)

      const selfLinkError = selfLinkValidation.data?.invalid_links?.find(
        (link: any) => link.child_id === steakDinnerId
      )
      expect(selfLinkError?.reason).toBe('self_link')

      // Verify actual attempt is prevented
      const selfLinkAttempt = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakDinnerId]
      })

      expect(selfLinkAttempt.data?.success).toBe(true) // Function succeeds
      expect(selfLinkAttempt.data?.links_created).toBe(0) // But no links created
      expect(selfLinkAttempt.data?.warnings).toContain('Cannot link item to itself')

      // Verify no self-reference was created
      const { data: item } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(item?.linked_items?.children || []).not.toContain(steakDinnerId)
      expect(item?.linked_items?.parents || []).not.toContain(steakDinnerId)
    })
  })

  describe('Indirect Circular Dependency Prevention', () => {
    it('should prevent A→C when A→B→C already exists', async () => {
      // Create chain: Steak Dinner → Steak → Onions
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [onionsId]
      })

      // Verify chain exists
      const childrenOfDinner = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })
      const childrenOfSteak = await supabase.rpc('get_child_items', {
        parent_item_id: steakId
      })

      expect(childrenOfDinner.data).toHaveLength(1)
      expect(childrenOfSteak.data).toHaveLength(1)
      expect(childrenOfSteak.data?.[0]?.id).toBe(onionsId)

      // **Key Action**: Try to create Onions → Steak Dinner (would create cycle)
      const circularValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: onionsId,
        child_item_ids: [steakDinnerId]
      })

      expect(circularValidation.data?.can_link).toBe(false)

      const circularError = circularValidation.data?.invalid_links?.find(
        (link: any) => link.child_id === steakDinnerId
      )
      expect(circularError?.reason).toBe('circular_dependency')

      // Verify cycle is explained by path: Onions → Steak Dinner → Steak → Onions
      const actualAttempt = await supabase.rpc('create_parent_child_link', {
        parent_item_id: onionsId,
        child_item_ids: [steakDinnerId]
      })

      expect(actualAttempt.data?.links_created).toBe(0)
      expect(actualAttempt.data?.warnings?.[0]).toContain('circular dependency')
    })

    it('should allow valid links in chain while preventing cycles', async () => {
      // Create chain: A → B → C
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [onionsId]
      })

      // **Valid Action**: A → C should be allowed (direct link in same direction)
      const validDirectLink = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakDinnerId,
        child_item_ids: [onionsId]
      })

      expect(validDirectLink.data?.can_link).toBe(true)
      expect(validDirectLink.data?.valid_links).toContain(onionsId)

      // Create the valid link
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [onionsId]
      })

      // Verify both relationships exist
      const directChildren = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      const childIds = directChildren.data?.map(c => c.id) || []
      expect(childIds).toContain(steakId) // Original chain link
      expect(childIds).toContain(onionsId) // New direct link

      // **Invalid Action**: But C → A should still be blocked
      const stillInvalidReverse = await supabase.rpc('validate_link_creation', {
        parent_item_id: onionsId,
        child_item_ids: [steakDinnerId]
      })

      expect(stillInvalidReverse.data?.can_link).toBe(false)
    })
  })

  describe('Complex Multi-Level Cycle Detection', () => {
    it('should detect cycles in complex hierarchies', async () => {
      // Create complex structure: A → B → C → D
      //                          A → C
      //                          B → D
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId, // A
        child_item_ids: [steakId] // B
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId, // B
        child_item_ids: [onionsId] // C
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: onionsId, // C
        child_item_ids: [groundBeefId] // D
      })

      // Add shortcuts
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId, // A
        child_item_ids: [onionsId] // C
      })

      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId, // B
        child_item_ids: [groundBeefId] // D
      })

      // Verify complex structure
      const allRelationships = await Promise.all([
        supabase.rpc('get_child_items', { parent_item_id: steakDinnerId }),
        supabase.rpc('get_child_items', { parent_item_id: steakId }),
        supabase.rpc('get_child_items', { parent_item_id: onionsId })
      ])

      expect(allRelationships[0].data).toHaveLength(2) // A has 2 children
      expect(allRelationships[1].data).toHaveLength(2) // B has 2 children
      expect(allRelationships[2].data).toHaveLength(1) // C has 1 child

      // **Key Test**: Try to create cycle D → A (would create multiple cycle paths)
      const complexCycleValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: groundBeefId, // D
        child_item_ids: [steakDinnerId] // A
      })

      expect(complexCycleValidation.data?.can_link).toBe(false)

      // Any of these paths would create a cycle:
      // D → A → B → C → D
      // D → A → C → D
      // D → A → B → D
      const cycleError = complexCycleValidation.data?.invalid_links?.find(
        (link: any) => link.child_id === steakDinnerId
      )
      expect(cycleError?.reason).toBe('circular_dependency')
    })

    it('should handle deep hierarchy cycle detection efficiently', async () => {
      // Create deep chain for performance testing
      const chainItems = [steakDinnerId, steakId, onionsId, groundBeefId]

      // Create sequential chain A → B → C → D
      for (let i = 0; i < chainItems.length - 1; i++) {
        await supabase.rpc('create_parent_child_link', {
          parent_item_id: chainItems[i],
          child_item_ids: [chainItems[i + 1]]
        })
      }

      const startTime = Date.now()

      // Try to create cycle from end to beginning
      const deepCycleValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: chainItems[chainItems.length - 1],
        child_item_ids: [chainItems[0]]
      })

      const endTime = Date.now()

      // Should detect cycle efficiently
      expect(deepCycleValidation.data?.can_link).toBe(false)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast

      const cycleError = deepCycleValidation.data?.invalid_links?.find(
        (link: any) => link.child_id === chainItems[0]
      )
      expect(cycleError?.reason).toBe('circular_dependency')
    })
  })

  describe('Mixed Valid and Invalid Relationships', () => {
    it('should handle batch operations with mixed valid and circular links', async () => {
      // Create initial relationship
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // **Key Action**: Try to create multiple links where some would be circular
      const mixedValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakId,
        child_item_ids: [
          onionsId,      // Valid
          groundBeefId,  // Valid
          steakDinnerId  // Invalid (circular)
        ]
      })

      expect(mixedValidation.data?.can_link).toBe(false) // Has invalid links
      expect(mixedValidation.data?.valid_links).toContain(onionsId)
      expect(mixedValidation.data?.valid_links).toContain(groundBeefId)
      expect(mixedValidation.data?.valid_links).not.toContain(steakDinnerId)

      const circularError = mixedValidation.data?.invalid_links?.find(
        (link: any) => link.child_id === steakDinnerId
      )
      expect(circularError?.reason).toBe('circular_dependency')

      // Attempt actual creation
      const mixedCreation = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [onionsId, groundBeefId, steakDinnerId]
      })

      expect(mixedCreation.data?.success).toBe(true) // Succeeds for valid links
      expect(mixedCreation.data?.links_created).toBe(2) // Only valid ones created
      expect(mixedCreation.data?.warnings).toContain('Cannot create circular dependency')

      // Verify only valid links were created
      const { data: steakChildren } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      expect(steakChildren?.linked_items?.children).toContain(onionsId)
      expect(steakChildren?.linked_items?.children).toContain(groundBeefId)
      expect(steakChildren?.linked_items?.children).not.toContain(steakDinnerId)
    })

    it('should provide clear error messages for UI feedback', async () => {
      // Create relationship for testing
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Test various error scenarios
      const testCases = [
        {
          parent: steakId,
          children: [steakDinnerId],
          expectedReason: 'circular_dependency',
          description: 'direct circular dependency'
        },
        {
          parent: steakDinnerId,
          children: [steakDinnerId],
          expectedReason: 'self_link',
          description: 'self-linking attempt'
        }
      ]

      for (const testCase of testCases) {
        const validation = await supabase.rpc('validate_link_creation', {
          parent_item_id: testCase.parent,
          child_item_ids: testCase.children
        })

        expect(validation.data?.can_link).toBe(false)

        const error = validation.data?.invalid_links?.find(
          (link: any) => link.child_id === testCase.children[0]
        )

        expect(error?.reason).toBe(testCase.expectedReason)
        expect(typeof error?.child_id).toBe('string') // UI needs the ID

        // Verify error is actionable for UI
        expect(['circular_dependency', 'self_link']).toContain(error?.reason)
      }
    })
  })

  describe('Edge Cases and Recovery', () => {
    it('should handle corrupted link data during cycle detection', async () => {
      // This tests the robustness of cycle detection with data integrity issues

      // Create valid relationship first
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Validation should still work even if some data is malformed
      const validation = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      // Should detect cycle despite any data issues
      expect(validation.data?.can_link).toBe(false)
    })

    it('should allow cycle resolution by removing blocking relationships', async () => {
      // Create blocking relationship
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Verify cycle would be blocked
      const blockedValidation = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      expect(blockedValidation.data?.can_link).toBe(false)

      // Remove blocking relationship
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      // Verify reverse link now allowed
      const unblocked_validation = await supabase.rpc('validate_link_creation', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      expect(unblocked_validation.data?.can_link).toBe(true)

      // Create the previously blocked relationship
      const newLinkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakId,
        child_item_ids: [steakDinnerId]
      })

      expect(newLinkResult.data?.success).toBe(true)
      expect(newLinkResult.data?.links_created).toBe(1)
    })

    it('should maintain cycle detection with concurrent modifications', async () => {
      // Create initial state
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Concurrent operations: one tries to create cycle, other modifies structure
      const concurrentPromises = [
        supabase.rpc('validate_link_creation', {
          parent_item_id: steakId,
          child_item_ids: [steakDinnerId]
        }),
        supabase.rpc('create_parent_child_link', {
          parent_item_id: steakId,
          child_item_ids: [onionsId]
        })
      ]

      const results = await Promise.all(concurrentPromises)

      // Validation should still correctly identify cycle
      expect(results[0].data?.can_link).toBe(false)

      // Valid link creation should succeed
      expect(results[1].data?.success).toBe(true)

      // Final state should be consistent
      const finalState = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakDinnerId, steakId, onionsId])

      // No cycles should exist
      const steak = finalState.data?.find(i => i.id === steakId)
      expect(steak?.linked_items?.parents).toContain(steakDinnerId) // Original relationship
      expect(steak?.linked_items?.children).toContain(onionsId) // New relationship
      expect(steak?.linked_items?.children).not.toContain(steakDinnerId) // No cycle
    })
  })
})