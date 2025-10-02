/**
 * Database API Layer for Enhanced Cross-List Linking
 * Provides typed wrappers around Supabase RPC functions
 */

import { supabase } from './supabase'
import type {
  CreateParentChildLinkRequest,
  CreateParentChildLinkResponse,
  RemoveParentChildLinkRequest,
  RemoveParentChildLinkResponse,
  ValidateLinkCreationRequest,
  ValidateLinkCreationResponse,
  GetChildItemsRequest,
  GetParentItemsRequest,
  LinkedItemInfo,
  UpdateItemWithPropagationRequest,
  UpdateItemWithPropagationResponse,
  PreviewStatusPropagationRequest,
  PreviewStatusPropagationResponse
} from '../types/enhanced-linking'

/**
 * Create parent-child hierarchical links
 *
 * @param request - Parent item ID and array of child item IDs
 * @returns Response with success status, links created count, and warnings
 */
export async function createParentChildLink(
  request: CreateParentChildLinkRequest
): Promise<{ data: CreateParentChildLinkResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('create_parent_child_link', {
      parent_item_id: request.parent_item_id,
      child_item_ids: request.child_item_ids
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as CreateParentChildLinkResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error creating parent-child link'
    }
  }
}

/**
 * Remove parent-child hierarchical link
 *
 * @param request - Parent and child item IDs
 * @returns Response with success status
 */
export async function removeParentChildLink(
  request: RemoveParentChildLinkRequest
): Promise<{ data: RemoveParentChildLinkResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('remove_parent_child_link', {
      parent_item_id: request.parent_item_id,
      child_item_id: request.child_item_id
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as RemoveParentChildLinkResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error removing parent-child link'
    }
  }
}

/**
 * Validate link creation before attempting to create
 * Checks for circular dependencies, self-links, and other validation rules
 *
 * @param request - Parent item ID and array of child item IDs to validate
 * @returns Validation result with valid/invalid links and reasons
 */
export async function validateLinkCreation(
  request: ValidateLinkCreationRequest
): Promise<{ data: ValidateLinkCreationResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('validate_link_creation', {
      parent_item_id: request.parent_item_id,
      child_item_ids: request.child_item_ids
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as ValidateLinkCreationResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error validating link creation'
    }
  }
}

/**
 * Get all child items for a parent
 * Returns items that this parent controls (parent → child relationship)
 *
 * @param request - Parent item ID
 * @returns Array of linked item info for all children
 */
export async function getChildItems(
  request: GetChildItemsRequest
): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('get_child_items', {
      parent_item_id: request.parent_item_id
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as LinkedItemInfo[], error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error getting child items'
    }
  }
}

/**
 * Get all parent items for a child
 * Returns items that control this child (child ← parent relationship)
 *
 * @param request - Child item ID
 * @returns Array of linked item info for all parents
 */
export async function getParentItems(
  request: GetParentItemsRequest
): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('get_parent_items', {
      child_item_id: request.child_item_id
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as LinkedItemInfo[], error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error getting parent items'
    }
  }
}

/**
 * Update item with automatic status propagation
 * When a parent item moves from completed → todo, all completed children are reset to todo
 *
 * @param request - Item update fields including optional status change
 * @returns Response with updated item and propagated updates
 */
export async function updateItemWithPropagation(
  request: UpdateItemWithPropagationRequest
): Promise<{ data: UpdateItemWithPropagationResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('update_item_with_propagation', {
      item_id: request.item_id,
      new_content: request.new_content || null,
      new_is_completed: request.new_is_completed !== undefined ? request.new_is_completed : null,
      new_target_date: request.new_target_date || null,
      new_position: request.new_position !== undefined ? request.new_position : null,
      new_linked_items: request.new_linked_items || null
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as UpdateItemWithPropagationResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error updating item with propagation'
    }
  }
}

/**
 * Preview status propagation without making changes
 * Shows which items would be affected by a status change
 *
 * @param request - Item ID and proposed new status
 * @returns Preview of affected items
 */
export async function previewStatusPropagation(
  request: PreviewStatusPropagationRequest
): Promise<{ data: PreviewStatusPropagationResponse | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('preview_status_propagation', {
      item_id: request.item_id,
      new_status: request.new_status
    } as any)

    if (error) {
      return { data: null, error: error.message }
    }

    return { data: data as PreviewStatusPropagationResponse, error: null }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error previewing status propagation'
    }
  }
}

// Helper utility functions

/**
 * Check if an item has any parent-child relationships
 */
export async function hasParentChildRelationships(
  itemId: string
): Promise<{ hasRelationships: boolean; error: string | null }> {
  try {
    const [childrenResult, parentsResult] = await Promise.all([
      getChildItems({ parent_item_id: itemId }),
      getParentItems({ child_item_id: itemId })
    ])

    if (childrenResult.error || parentsResult.error) {
      return {
        hasRelationships: false,
        error: childrenResult.error || parentsResult.error
      }
    }

    const hasRelationships =
      (childrenResult.data?.length || 0) > 0 || (parentsResult.data?.length || 0) > 0

    return { hasRelationships, error: null }
  } catch (err) {
    return {
      hasRelationships: false,
      error: err instanceof Error ? err.message : 'Unknown error checking relationships'
    }
  }
}

/**
 * Bulk create multiple parent-child links
 * Validates all links before creating any
 */
export async function bulkCreateParentChildLinks(
  requests: CreateParentChildLinkRequest[]
): Promise<{
  data: { successful: number; failed: number; results: CreateParentChildLinkResponse[] } | null
  error: string | null
}> {
  try {
    const results: CreateParentChildLinkResponse[] = []
    let successful = 0
    let failed = 0

    for (const request of requests) {
      const result = await createParentChildLink(request)
      if (result.data) {
        results.push(result.data)
        if (result.data.success) {
          successful += result.data.links_created
        } else {
          failed++
        }
      } else {
        failed++
        results.push({
          success: false,
          links_created: 0,
          error: result.error || 'Unknown error'
        })
      }
    }

    return {
      data: { successful, failed, results },
      error: null
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error in bulk create'
    }
  }
}

/**
 * Get complete link summary for an item
 * Returns both children and parents
 */
export async function getItemLinkSummary(itemId: string): Promise<{
  data: {
    item_id: string
    children: LinkedItemInfo[]
    parents: LinkedItemInfo[]
    total_children: number
    total_parents: number
  } | null
  error: string | null
}> {
  try {
    const [childrenResult, parentsResult] = await Promise.all([
      getChildItems({ parent_item_id: itemId }),
      getParentItems({ child_item_id: itemId })
    ])

    if (childrenResult.error || parentsResult.error) {
      return {
        data: null,
        error: childrenResult.error || parentsResult.error
      }
    }

    return {
      data: {
        item_id: itemId,
        children: childrenResult.data || [],
        parents: parentsResult.data || [],
        total_children: childrenResult.data?.length || 0,
        total_parents: parentsResult.data?.length || 0
      },
      error: null
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error getting link summary'
    }
  }
}