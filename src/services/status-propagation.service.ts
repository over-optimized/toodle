/**
 * Status Propagation Service
 * Handles automatic status updates for parent-child relationships
 * When parent moves from completed → todo, all completed children reset to todo
 */

import {
  updateItemWithPropagation as dbUpdateItemWithPropagation,
  previewStatusPropagation as dbPreviewStatusPropagation
} from '../lib/enhanced-linking-api'
import { validateStatusPropagation, findPropagationAffectedItems } from '../utils/link-validation'
import { supabase } from '../lib/supabase'
import type {
  UpdateItemWithPropagationRequest,
  UpdateItemWithPropagationResponse,
  PreviewStatusPropagationResponse,
  StatusPropagationEvent
} from '../types/enhanced-linking'
import type { Item } from '../types'

export class StatusPropagationService {
  /**
   * Update item with automatic status propagation
   * If parent moves from completed → todo, propagates to children
   *
   * @param request - Item update request with propagation
   * @returns Update response with propagated changes
   */
  async updateWithPropagation(
    request: UpdateItemWithPropagationRequest
  ): Promise<{ data: UpdateItemWithPropagationResponse | null; error: string | null }> {
    // Validate if status change requested
    if (request.new_is_completed !== undefined) {
      const validation = await validateStatusPropagation(
        request.item_id,
        request.new_is_completed
      )

      if (!validation.isValid) {
        return {
          data: {
            success: false,
            error: validation.errors.join('; ')
          },
          error: validation.errors.join('; ')
        }
      }
    }

    // Call database RPC
    return dbUpdateItemWithPropagation(request)
  }

  /**
   * Preview status propagation without making changes
   * Shows which items would be affected
   *
   * @param itemId - Item ID
   * @param newStatus - Proposed new status
   * @returns Preview of affected items
   */
  async previewPropagation(
    itemId: string,
    newStatus: boolean
  ): Promise<{ data: PreviewStatusPropagationResponse | null; error: string | null }> {
    return dbPreviewStatusPropagation({
      item_id: itemId,
      new_status: newStatus
    })
  }

  /**
   * Get items that would be affected by status change
   * Client-side computation for UI validation
   *
   * @param itemId - Item ID
   * @param newStatus - Proposed new status
   * @returns Array of affected item IDs
   */
  async getAffectedItems(itemId: string, newStatus: boolean): Promise<string[]> {
    return findPropagationAffectedItems(itemId, newStatus)
  }

  /**
   * Check if status change would trigger propagation
   * Quick check for UI to show warnings
   *
   * @param itemId - Item ID
   * @param newStatus - Proposed new status
   * @returns True if propagation would occur
   */
  async wouldPropagate(itemId: string, newStatus: boolean): Promise<boolean> {
    const affectedItems = await this.getAffectedItems(itemId, newStatus)
    return affectedItems.length > 0
  }

  /**
   * Update item status with propagation (simplified)
   * Helper for common case of just changing status
   *
   * @param itemId - Item ID
   * @param isCompleted - New completion status
   * @returns Update response
   */
  async updateItemStatus(
    itemId: string,
    isCompleted: boolean
  ): Promise<{ data: UpdateItemWithPropagationResponse | null; error: string | null }> {
    return this.updateWithPropagation({
      item_id: itemId,
      new_is_completed: isCompleted
    })
  }

  /**
   * Manually propagate status to children
   * Force propagation even if not following normal rules
   * USE WITH CAUTION - bypasses normal propagation logic
   *
   * @param parentId - Parent item ID
   * @param newStatus - Status to set on all children
   * @returns Count of updated children
   */
  async forcePropagate(
    parentId: string,
    newStatus: boolean
  ): Promise<{
    data: { updated_count: number; updated_items: string[] } | null
    error: string | null
  }> {
    try {
      // Get all children
      const { data: children, error } = await supabase
        .rpc('get_child_items', { parent_item_id: parentId })

      if (error || !children) {
        return { data: null, error: error?.message || 'Failed to get children' }
      }

      const updatedItems: string[] = []

      // Update each child
      for (const child of children) {
        const { error: updateError } = await supabase
          .from('items')
          .update({
            is_completed: newStatus,
            completed_at: newStatus ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', child.id)

        if (!updateError) {
          updatedItems.push(child.id)
        }
      }

      return {
        data: {
          updated_count: updatedItems.length,
          updated_items: updatedItems
        },
        error: null
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error in force propagate'
      }
    }
  }

  /**
   * Get propagation history for an item
   * Useful for debugging and audit trails
   *
   * @param itemId - Item ID
   * @returns Recent propagation events
   */
  async getPropagationHistory(_itemId: string): Promise<{
    data: StatusPropagationEvent[] | null
    error: string | null
  }> {
    // This would require a propagation_history table
    // For now, return empty array as placeholder
    return {
      data: [],
      error: null
    }
  }

  /**
   * Calculate propagation impact
   * Shows how many items would be affected in the hierarchy
   *
   * @param itemId - Item ID
   * @param newStatus - Proposed new status
   * @returns Impact statistics
   */
  async calculatePropagationImpact(
    itemId: string,
    newStatus: boolean
  ): Promise<{
    data: {
      would_propagate: boolean
      direct_children_affected: number
      total_hierarchy_affected: number
      affected_lists: Set<string>
    } | null
    error: string | null
  }> {
    try {
      // Get preview from database
      const preview = await this.previewPropagation(itemId, newStatus)

      if (preview.error || !preview.data) {
        return { data: null, error: preview.error }
      }

      // Get detailed info about affected items
      const affectedIds = preview.data.affected_items.map((item) => item.item_id)

      if (affectedIds.length === 0) {
        return {
          data: {
            would_propagate: false,
            direct_children_affected: 0,
            total_hierarchy_affected: 0,
            affected_lists: new Set()
          },
          error: null
        }
      }

      // Get list IDs for affected items
      const { data: items } = await supabase
        .from('items')
        .select('id, list_id')
        .in('id', affectedIds)

      const affectedLists = new Set(items?.map((item) => item.list_id) || [])

      // Calculate hierarchy depth (future enhancement)
      const totalHierarchy = affectedIds.length // Simplified for now

      return {
        data: {
          would_propagate: preview.data.would_propagate,
          direct_children_affected: preview.data.affected_count,
          total_hierarchy_affected: totalHierarchy,
          affected_lists: affectedLists
        },
        error: null
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error calculating impact'
      }
    }
  }

  /**
   * Batch update multiple items with propagation
   * Useful for bulk operations
   *
   * @param updates - Array of update requests
   * @returns Summary of updates and propagations
   */
  async batchUpdateWithPropagation(
    updates: UpdateItemWithPropagationRequest[]
  ): Promise<{
    data: {
      successful: number
      failed: number
      total_propagations: number
    } | null
    error: string | null
  }> {
    try {
      let successful = 0
      let failed = 0
      let totalPropagations = 0

      for (const update of updates) {
        const result = await this.updateWithPropagation(update)

        if (result.data?.success) {
          successful++
          totalPropagations += result.data.update_count || 0
        } else {
          failed++
        }
      }

      return {
        data: {
          successful,
          failed,
          total_propagations: totalPropagations
        },
        error: null
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error in batch update'
      }
    }
  }

  /**
   * Subscribe to propagation events (real-time)
   * Sets up real-time listener for propagation events
   *
   * @param listId - List ID to monitor
   * @param callback - Callback for propagation events
   * @returns Unsubscribe function
   */
  subscribeToPropagationEvents(
    listId: string,
    callback: (event: StatusPropagationEvent) => void
  ): () => void {
    // Subscribe to item updates on this list
    const subscription = supabase
      .channel(`propagation:${listId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items',
          filter: `list_id=eq.${listId}`
        },
        (payload) => {
          // Check if this was a status change
          const newItem = payload.new as Item
          const oldItem = payload.old as Item

          if (newItem.is_completed !== oldItem.is_completed) {
            // Status changed - could be propagation
            const event: StatusPropagationEvent = {
              parent_item_id: newItem.id,
              affected_items: [
                {
                  item_id: newItem.id,
                  list_id: newItem.list_id,
                  old_status: oldItem.is_completed,
                  new_status: newItem.is_completed
                }
              ],
              timestamp: new Date().toISOString()
            }

            callback(event)
          }
        }
      )
      .subscribe()

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe()
    }
  }
}

// Singleton instance
export const statusPropagationService = new StatusPropagationService()