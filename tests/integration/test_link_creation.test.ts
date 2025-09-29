import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../../src/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// Integration test for basic parent-child link creation workflow
// Tests Quickstart Scenario 1: Basic Parent-Child Link Creation
// This test MUST fail initially (TDD requirement)

describe('Basic Parent-Child Link Creation Integration', () => {
  let testUserId: string
  let mealPlanningListId: string
  let groceryListId: string
  let steakDinnerId: string
  let steakId: string
  let potatoesId: string
  let carrotsId: string

  beforeEach(async () => {
    // Setup test data matching quickstart scenario
    testUserId = uuidv4()
    mealPlanningListId = uuidv4()
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

    // Create lists as per quickstart scenario
    await supabase.from('lists').insert([
      {
        id: mealPlanningListId,
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
        list_id: mealPlanningListId,
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
      }
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await supabase.from('items').delete().in('id', [steakDinnerId, steakId, potatoesId, carrotsId])
    await supabase.from('lists').delete().in('id', [mealPlanningListId, groceryListId])
    await supabase.from('users').delete().eq('id', testUserId)
  })

  describe('Complete Link Creation Workflow', () => {
    it('should complete full parent-child link creation scenario', async () => {
      // Step 1: Create parent-child links (Steak Dinner -> Steak, Potatoes, Carrots)
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, potatoesId, carrotsId]
      })

      expect(linkResult.error).toBeNull()
      expect(linkResult.data?.success).toBe(true)
      expect(linkResult.data?.links_created).toBe(3)

      // Step 2: Verify parent item shows correct children indicator
      const { data: parentItem } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parentItem?.linked_items?.children).toHaveLength(3)
      expect(parentItem?.linked_items?.children).toContain(steakId)
      expect(parentItem?.linked_items?.children).toContain(potatoesId)
      expect(parentItem?.linked_items?.children).toContain(carrotsId)

      // Step 3: Verify child items show correct parent indicator
      const { data: childItems } = await supabase
        .from('items')
        .select('id, linked_items')
        .in('id', [steakId, potatoesId, carrotsId])

      for (const child of childItems || []) {
        expect(child.linked_items?.parents).toContain(steakDinnerId)
        expect(child.linked_items?.parents).toHaveLength(1)
      }

      // Step 4: Test visual indicators calculation
      // Parent should show 🔗⬇️3 (3 children)
      const childrenCount = parentItem?.linked_items?.children?.length || 0
      expect(childrenCount).toBe(3)

      // Children should show 🔗⬆️1 (1 parent each)
      for (const child of childItems || []) {
        const parentsCount = child.linked_items?.parents?.length || 0
        expect(parentsCount).toBe(1)
      }
    })

    it('should handle link creation with mixed item states', async () => {
      // Set up items in different completion states
      await supabase
        .from('items')
        .update({ is_completed: true })
        .eq('id', steakId)

      await supabase
        .from('items')
        .update({ is_completed: false })
        .eq('id', potatoesId)

      // Create links
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, potatoesId, carrotsId]
      })

      expect(linkResult.data?.success).toBe(true)

      // Verify links created regardless of completion state
      const { data: children } = await supabase
        .from('items')
        .select('id, is_completed, linked_items')
        .in('id', [steakId, potatoesId, carrotsId])

      for (const child of children || []) {
        expect(child.linked_items?.parents).toContain(steakDinnerId)
      }

      // Completion states should be preserved
      const steak = children?.find(c => c.id === steakId)
      const potatoes = children?.find(c => c.id === potatoesId)
      const carrots = children?.find(c => c.id === carrotsId)

      expect(steak?.is_completed).toBe(true) // Preserved
      expect(potatoes?.is_completed).toBe(false) // Preserved
      expect(carrots?.is_completed).toBe(false) // Original state
    })

    it('should support incremental link addition', async () => {
      // First create partial links
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, potatoesId]
      })

      // Verify initial state
      const { data: initial } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(initial?.linked_items?.children).toHaveLength(2)

      // Add additional child
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [carrotsId]
      })

      // Verify final state
      const { data: final } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(final?.linked_items?.children).toHaveLength(3)
      expect(final?.linked_items?.children).toContain(steakId)
      expect(final?.linked_items?.children).toContain(potatoesId)
      expect(final?.linked_items?.children).toContain(carrotsId)
    })

    it('should handle bidirectional consistency validation', async () => {
      // Create links
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Verify bidirectional consistency
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      const { data: child } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakId)
        .single()

      // Parent should reference child
      expect(parent?.linked_items?.children).toContain(steakId)

      // Child should reference parent
      expect(child?.linked_items?.parents).toContain(steakDinnerId)
    })

    it('should preserve existing relationships when adding new ones', async () => {
      // Create initial relationship with existing legacy format
      await supabase
        .from('items')
        .update({
          linked_items: [potatoesId] // Legacy format
        })
        .eq('id', steakDinnerId)

      // Add new hierarchical relationship
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      // Verify both relationships preserved
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.linked_items?.children).toContain(steakId) // New hierarchical
      expect(parent?.linked_items?.bidirectional).toContain(potatoesId) // Converted legacy
    })

    it('should support cross-list linking verification', async () => {
      // Verify items are in different lists
      const { data: items } = await supabase
        .from('items')
        .select('id, list_id, lists!inner(title, type)')
        .in('id', [steakDinnerId, steakId])

      const parent = items?.find(i => i.id === steakDinnerId)
      const child = items?.find(i => i.id === steakId)

      expect(parent?.list_id).not.toBe(child?.list_id)
      expect(parent?.lists?.title).toBe('Meal Planning')
      expect(child?.lists?.title).toBe('Shopping')
      expect(parent?.lists?.type).toBe('simple')
      expect(child?.lists?.type).toBe('grocery')

      // Create cross-list link
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId]
      })

      expect(linkResult.data?.success).toBe(true)

      // Verify cross-list relationship established
      const childrenResult = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      expect(childrenResult.data).toHaveLength(1)
      expect(childrenResult.data?.[0]?.id).toBe(steakId)
      expect(childrenResult.data?.[0]?.list_title).toBe('Shopping')
      expect(childrenResult.data?.[0]?.list_type).toBe('grocery')
    })
  })

  describe('Error Handling in Workflow', () => {
    it('should gracefully handle partial failures in bulk linking', async () => {
      const nonExistentId = uuidv4()

      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, nonExistentId, potatoesId]
      })

      expect(linkResult.data?.success).toBe(true) // Should succeed for valid items
      expect(linkResult.data?.links_created).toBe(2) // Only valid items linked
      expect(linkResult.data?.warnings).toContain(`Child item not found: ${nonExistentId}`)

      // Verify valid items were linked
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.linked_items?.children).toContain(steakId)
      expect(parent?.linked_items?.children).toContain(potatoesId)
      expect(parent?.linked_items?.children).not.toContain(nonExistentId)
    })

    it('should prevent and warn about self-linking attempts', async () => {
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakDinnerId, steakId] // Include self-link
      })

      expect(linkResult.data?.success).toBe(true) // Succeeds for valid child
      expect(linkResult.data?.links_created).toBe(1) // Only valid link created
      expect(linkResult.data?.warnings).toContain('Cannot link item to itself')

      // Verify self-link was not created
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.linked_items?.children).toContain(steakId) // Valid child linked
      expect(parent?.linked_items?.children).not.toContain(steakDinnerId) // Self not linked
    })

    it('should handle empty child array gracefully', async () => {
      const linkResult = await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: []
      })

      expect(linkResult.data?.success).toBe(true)
      expect(linkResult.data?.links_created).toBe(0)

      // Parent should have no children
      const { data: parent } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', steakDinnerId)
        .single()

      expect(parent?.linked_items?.children || []).toHaveLength(0)
    })
  })

  describe('UI Integration Points', () => {
    it('should provide data needed for link indicators', async () => {
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, potatoesId, carrotsId]
      })

      // Get data that UI would use for indicators
      const { data: allItems } = await supabase
        .from('items')
        .select('id, content, linked_items')
        .in('id', [steakDinnerId, steakId, potatoesId, carrotsId])

      // Calculate indicator data for parent
      const parent = allItems?.find(i => i.id === steakDinnerId)
      const childrenCount = parent?.linked_items?.children?.length || 0
      const parentsCount = parent?.linked_items?.parents?.length || 0

      expect(childrenCount).toBe(3) // Should show ⬇️3
      expect(parentsCount).toBe(0)  // No parents

      // Calculate indicator data for children
      const children = allItems?.filter(i => i.id !== steakDinnerId) || []
      for (const child of children) {
        const childParentsCount = child.linked_items?.parents?.length || 0
        const childChildrenCount = child.linked_items?.children?.length || 0

        expect(childParentsCount).toBe(1) // Should show ⬆️1
        expect(childChildrenCount).toBe(0) // No children
      }
    })

    it('should support link management UI workflow', async () => {
      // Create initial links
      await supabase.rpc('create_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_ids: [steakId, potatoesId]
      })

      // Get linking summary for UI
      const childrenResult = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      expect(childrenResult.data).toHaveLength(2)

      // UI would display list with remove option
      // Test removal of one link
      await supabase.rpc('remove_parent_child_link', {
        parent_item_id: steakDinnerId,
        child_item_id: steakId
      })

      // Verify updated state for UI
      const updatedChildrenResult = await supabase.rpc('get_child_items', {
        parent_item_id: steakDinnerId
      })

      expect(updatedChildrenResult.data).toHaveLength(1)
      expect(updatedChildrenResult.data?.[0]?.id).toBe(potatoesId)
    })
  })
})