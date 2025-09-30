import { supabase } from '../lib/supabase'
import { statusPropagationService } from './status-propagation.service'
import { enhancedLinkingService } from './enhanced-linking.service'
import type {
  Item,
  CreateItemRequest,
  UpdateItemRequest,
  UpdateItemWithPropagationResponse
} from '../types'

export class ItemService {
  async createItem(listId: string, request: CreateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      const position = request.position ?? await this.getNextItemPosition(listId)

      const { data, error } = await (supabase as any)
        .from('items')
        .insert({
          list_id: listId,
          content: request.content,
          position,
          target_date: request.target_date,
          is_completed: false
        } as any)
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

  async updateItem(id: string, request: UpdateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      const updateData: any = { ...request }

      if (request.is_completed !== undefined && request.is_completed) {
        updateData.completed_at = new Date().toISOString()
      } else if (request.is_completed === false) {
        updateData.completed_at = null
      }

      const { data, error } = await (supabase as any)
        .from('items')
        .update(updateData as any)
        .eq('id', id)
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
   * Update item with automatic status propagation
   * If item is a parent and moves from completed → todo, resets completed children to todo
   */
  async updateItemWithPropagation(
    id: string,
    request: UpdateItemRequest
  ): Promise<{ data: UpdateItemWithPropagationResponse | null; error: string | null }> {
    try {
      const result = await statusPropagationService.updateWithPropagation({
        item_id: id,
        new_content: request.content,
        new_is_completed: request.is_completed,
        new_target_date: request.target_date,
        new_position: request.position
      })

      return result
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update item status with propagation
   * Convenience method for toggling completion status
   */
  async updateItemStatus(
    id: string,
    isCompleted: boolean
  ): Promise<{ data: UpdateItemWithPropagationResponse | null; error: string | null }> {
    return statusPropagationService.updateItemStatus(id, isCompleted)
  }

  /**
   * Preview status propagation impact before updating
   * Shows which items would be affected by status change
   */
  async previewStatusChange(id: string, newStatus: boolean) {
    return statusPropagationService.previewPropagation(id, newStatus)
  }

  /**
   * Get link summary for an item (children, parents, bidirectional)
   */
  async getItemLinks(itemId: string) {
    return enhancedLinkingService.getLinkSummary(itemId)
  }

  /**
   * Check if item has parent-child relationships
   */
  async hasParentChildRelationships(itemId: string) {
    return enhancedLinkingService.hasRelationships(itemId)
  }

  /**
   * Create parent-child links
   */
  async createParentChildLinks(parentItemId: string, childItemIds: string[]) {
    return enhancedLinkingService.createParentChildLinks({
      parent_item_id: parentItemId,
      child_item_ids: childItemIds
    })
  }

  /**
   * Remove parent-child link
   */
  async removeParentChildLink(parentItemId: string, childItemId: string) {
    return enhancedLinkingService.removeParentChildLink({
      parent_item_id: parentItemId,
      child_item_id: childItemId
    })
  }

  async deleteItem(id: string): Promise<{ error: string | null }> {
    try {
      // First, remove all links (parent-child and bidirectional)
      await enhancedLinkingService.removeAllLinks(id)

      // Then delete the item
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

      return { error: error?.message || null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getItem(id: string): Promise<{ data: Item | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getItems(): Promise<{ data: Item[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('position')

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getItemsByListId(listId: string): Promise<{ data: Item[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('position')

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async reorderItems(listId: string, itemIds: string[]): Promise<{ error: string | null }> {
    try {
      // Update positions for all items in the list
      const updates = itemIds.map((itemId, index) => ({
        id: itemId,
        position: index + 1
      }))

      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('items')
          .update({ position: update.position })
          .eq('id', update.id)
          .eq('list_id', listId)

        if (error) {
          return { error: error.message }
        }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async getNextItemPosition(listId: string): Promise<number> {
    const { data } = await supabase
      .from('items')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1)

    return ((data as any)?.[0]?.position || 0) + 1
  }
}

export const itemService = new ItemService()