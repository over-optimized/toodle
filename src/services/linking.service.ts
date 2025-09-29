import { supabase } from '../lib/supabase'
import type {
  Item,
  LinkedItemInfo,
  ItemLinkingSummary,
  LinkingValidationResult,
  BulkLinkOperation
} from '../types'

export class LinkingService {
  /**
   * Add links from a source item to one or more target items
   */
  async addLinks(sourceItemId: string, targetItemIds: string[]): Promise<{ data: Item | null; error: string | null }> {
    try {
      // Validate the linking operation
      const validation = await this.validateLinking(sourceItemId, targetItemIds)
      if (!validation.isValid) {
        return {
          data: null,
          error: validation.errors.join(', ')
        }
      }

      // Get current linked items
      const { data: currentItem, error: fetchError } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', sourceItemId)
        .single()

      if (fetchError) {
        return { data: null, error: fetchError.message }
      }

      // Merge new links with existing ones (avoid duplicates)
      const currentLinks = currentItem.linked_items || []
      const newLinks = [...new Set([...currentLinks, ...targetItemIds])]

      // Update the item with new linked items
      const { data, error } = await supabase
        .from('items')
        .update({ linked_items: newLinks })
        .eq('id', sourceItemId)
        .select()
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove links from a source item to one or more target items
   */
  async removeLinks(sourceItemId: string, targetItemIds: string[]): Promise<{ data: Item | null; error: string | null }> {
    try {
      // Get current linked items
      const { data: currentItem, error: fetchError } = await supabase
        .from('items')
        .select('linked_items')
        .eq('id', sourceItemId)
        .single()

      if (fetchError) {
        return { data: null, error: fetchError.message }
      }

      // Remove specified links
      const currentLinks = currentItem.linked_items || []
      const newLinks = currentLinks.filter(linkId => !targetItemIds.includes(linkId))

      // Update the item with new linked items
      const { data, error } = await supabase
        .from('items')
        .update({ linked_items: newLinks })
        .eq('id', sourceItemId)
        .select()
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Replace all links for a source item
   */
  async replaceLinks(sourceItemId: string, targetItemIds: string[]): Promise<{ data: Item | null; error: string | null }> {
    try {
      // Validate the linking operation
      const validation = await this.validateLinking(sourceItemId, targetItemIds)
      if (!validation.isValid) {
        return {
          data: null,
          error: validation.errors.join(', ')
        }
      }

      // Update the item with new linked items
      const { data, error } = await supabase
        .from('items')
        .update({ linked_items: targetItemIds })
        .eq('id', sourceItemId)
        .select()
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get detailed information about linked items for a source item
   */
  async getLinkedItemsInfo(sourceItemId: string): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_linked_items_info', { source_item_id: sourceItemId })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get items that link to a specific target item (reverse lookup)
   */
  async getItemsLinkingTo(targetItemId: string): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_items_linking_to', { target_item_id: targetItemId })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get comprehensive linking summary for an item (both directions)
   */
  async getItemLinkingSummary(itemId: string): Promise<{ data: ItemLinkingSummary | null; error: string | null }> {
    try {
      const [linkedToResult, linkingFromResult] = await Promise.all([
        this.getLinkedItemsInfo(itemId),
        this.getItemsLinkingTo(itemId)
      ])

      if (linkedToResult.error) {
        return { data: null, error: linkedToResult.error }
      }

      if (linkingFromResult.error) {
        return { data: null, error: linkingFromResult.error }
      }

      const summary: ItemLinkingSummary = {
        totalLinkedTo: linkedToResult.data?.length || 0,
        totalLinkingFrom: linkingFromResult.data?.length || 0,
        linkedToItems: linkedToResult.data || [],
        linkingFromItems: linkingFromResult.data || []
      }

      return { data: summary, error: null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Perform bulk linking operations
   */
  async performBulkOperation(operation: BulkLinkOperation): Promise<{ data: Item | null; error: string | null }> {
    switch (operation.operation) {
      case 'add':
        return this.addLinks(operation.sourceItemId, operation.targetItemIds)
      case 'remove':
        return this.removeLinks(operation.sourceItemId, operation.targetItemIds)
      case 'replace':
        return this.replaceLinks(operation.sourceItemId, operation.targetItemIds)
      default:
        return { data: null, error: 'Invalid bulk operation type' }
    }
  }

  /**
   * Get items from other lists that can be linked (for UI selection)
   */
  async getLinkableItems(sourceItemId: string, listIds?: string[]): Promise<{ data: Item[] | null; error: string | null }> {
    try {
      // Get the source item to find its list
      const { data: _sourceItem, error: sourceError } = await supabase
        .from('items')
        .select('list_id')
        .eq('id', sourceItemId)
        .single()

      if (sourceError) {
        return { data: null, error: sourceError.message }
      }

      // Build query for linkable items
      let query = supabase
        .from('items')
        .select(`
          id,
          list_id,
          content,
          is_completed,
          position,
          target_date,
          completed_at,
          created_at,
          updated_at,
          linked_items,
          lists!inner(title, type, user_id)
        `)
        .neq('id', sourceItemId) // Don't include the source item itself

      // If specific list IDs provided, filter by them
      if (listIds && listIds.length > 0) {
        query = query.in('list_id', listIds)
      } else {
        // Otherwise, get items from all lists owned by the same user
        query = query.eq('lists.user_id', (await supabase.auth.getUser()).data.user?.id)
      }

      const { data, error } = await query.order('lists.title').order('position')

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove all links associated with a deleted item
   */
  async removeItemFromAllLinks(itemId: string): Promise<{ error: string | null }> {
    try {
      // Find all items that link to this item and remove the link
      const { data: linkingItems, error: fetchError } = await supabase
        .from('items')
        .select('id, linked_items')
        .contains('linked_items', [itemId])

      if (fetchError) {
        return { error: fetchError.message }
      }

      // Update each item to remove the deleted item from its links
      if (linkingItems && linkingItems.length > 0) {
        const updates = linkingItems.map(async (item) => {
          const newLinks = (item.linked_items || []).filter(linkId => linkId !== itemId)
          return supabase
            .from('items')
            .update({ linked_items: newLinks })
            .eq('id', item.id)
        })

        await Promise.all(updates)
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate linking operation
   */
  private async validateLinking(sourceItemId: string, targetItemIds: string[]): Promise<LinkingValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Check if source item exists
      const { data: sourceItem, error: sourceError } = await supabase
        .from('items')
        .select('id, list_id, linked_items, lists!inner(user_id)')
        .eq('id', sourceItemId)
        .single()

      if (sourceError || !sourceItem) {
        errors.push('Source item not found')
        return { isValid: false, errors, warnings }
      }

      // Check current link count
      const currentLinks = sourceItem.linked_items || []
      const totalAfterAdd = new Set([...currentLinks, ...targetItemIds]).size

      if (totalAfterAdd > 50) {
        errors.push('Maximum of 50 linked items allowed per item')
      }

      // Check if target items exist and belong to same user
      if (targetItemIds.length > 0) {
        const { data: targetItems, error: targetError } = await supabase
          .from('items')
          .select('id, lists!inner(user_id)')
          .in('id', targetItemIds)

        if (targetError) {
          errors.push('Error validating target items')
          return { isValid: false, errors, warnings }
        }

        const foundTargetIds = targetItems?.map(item => item.id) || []
        const missingIds = targetItemIds.filter(id => !foundTargetIds.includes(id))

        if (missingIds.length > 0) {
          errors.push(`Target items not found: ${missingIds.join(', ')}`)
        }

        // Check if all target items belong to same user
        const sourceUserId = sourceItem.lists.user_id
        const invalidTargets = targetItems?.filter(item => item.lists.user_id !== sourceUserId) || []

        if (invalidTargets.length > 0) {
          errors.push('Cannot link to items from different users')
        }

        // Warn about self-linking (should be prevented at UI level)
        if (targetItemIds.includes(sourceItemId)) {
          warnings.push('Cannot link item to itself')
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      return {
        isValid: false,
        errors: ['Validation error: ' + (error instanceof Error ? error.message : 'Unknown error')],
        warnings
      }
    }
  }
}

export const linkingService = new LinkingService()