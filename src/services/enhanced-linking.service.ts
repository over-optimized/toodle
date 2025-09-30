/**
 * Enhanced Linking Service
 * Business logic layer for parent-child hierarchical linking
 * Wraps database API with additional validation and business rules
 */

import {
  createParentChildLink as dbCreateParentChildLink,
  removeParentChildLink as dbRemoveParentChildLink,
  validateLinkCreation as dbValidateLinkCreation,
  getChildItems as dbGetChildItems,
  getParentItems as dbGetParentItems,
  getItemLinkSummary,
  hasParentChildRelationships,
  bulkCreateParentChildLinks
} from '../lib/enhanced-linking-api'
import {
  validateLinkCreationLocal,
  validateLinkRemoval,
  checkCircularDependency
} from '../utils/link-validation'
import type {
  CreateParentChildLinkRequest,
  CreateParentChildLinkResponse,
  RemoveParentChildLinkRequest,
  RemoveParentChildLinkResponse,
  LinkedItemInfo,
  ItemLinkSummary,
  LinkValidationResult,
  CircularDependencyCheck
} from '../types/enhanced-linking'

export class EnhancedLinkingService {
  /**
   * Create parent-child links with comprehensive validation
   * Validates on client-side first, then calls database
   *
   * @param request - Parent item ID and array of child item IDs
   * @returns Response with success status and created links count
   */
  async createParentChildLinks(
    request: CreateParentChildLinkRequest
  ): Promise<{ data: CreateParentChildLinkResponse | null; error: string | null }> {
    // Client-side validation first
    const validation = await validateLinkCreationLocal(
      request.parent_item_id,
      request.child_item_ids
    )

    if (!validation.isValid) {
      return {
        data: {
          success: false,
          links_created: 0,
          error: validation.errors.join('; '),
          warnings: validation.warnings
        },
        error: validation.errors.join('; ')
      }
    }

    // Call database RPC
    const result = await dbCreateParentChildLink(request)

    return result
  }

  /**
   * Remove parent-child link with validation
   *
   * @param request - Parent and child item IDs
   * @returns Response with success status
   */
  async removeParentChildLink(
    request: RemoveParentChildLinkRequest
  ): Promise<{ data: RemoveParentChildLinkResponse | null; error: string | null }> {
    // Validate removal
    const validation = await validateLinkRemoval(request.parent_item_id, request.child_item_id)

    if (!validation.isValid) {
      return {
        data: {
          success: false,
          error: validation.errors.join('; ')
        },
        error: validation.errors.join('; ')
      }
    }

    // Call database RPC
    const result = await dbRemoveParentChildLink(request)

    return result
  }

  /**
   * Get all child items for a parent
   * Returns items this parent controls
   *
   * @param parentItemId - Parent item ID
   * @returns Array of linked item info for children
   */
  async getChildItems(
    parentItemId: string
  ): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
    return dbGetChildItems({ parent_item_id: parentItemId })
  }

  /**
   * Get all parent items for a child
   * Returns items that control this child
   *
   * @param childItemId - Child item ID
   * @returns Array of linked item info for parents
   */
  async getParentItems(
    childItemId: string
  ): Promise<{ data: LinkedItemInfo[] | null; error: string | null }> {
    return dbGetParentItems({ child_item_id: childItemId })
  }

  /**
   * Get complete link summary for an item
   * Includes both children and parents
   *
   * @param itemId - Item ID
   * @returns Complete link summary with counts
   */
  async getLinkSummary(itemId: string): Promise<{
    data: ItemLinkSummary | null
    error: string | null
  }> {
    const result = await getItemLinkSummary(itemId)

    if (result.error || !result.data) {
      return { data: null, error: result.error }
    }

    // Transform to ItemLinkSummary format
    return {
      data: {
        item_id: result.data.item_id,
        total_links: result.data.total_children + result.data.total_parents,
        children_count: result.data.total_children,
        parents_count: result.data.total_parents,
        bidirectional_count: 0, // Enhanced links don't use bidirectional
        children: result.data.children,
        parents: result.data.parents,
        bidirectional: []
      },
      error: null
    }
  }

  /**
   * Validate link creation without making changes
   * Useful for UI validation before submission
   *
   * @param parentItemId - Parent item ID
   * @param childItemIds - Array of child item IDs to validate
   * @returns Validation result with errors and warnings
   */
  async validateLinks(
    parentItemId: string,
    childItemIds: string[]
  ): Promise<LinkValidationResult> {
    // Use client-side validation
    return validateLinkCreationLocal(parentItemId, childItemIds)
  }

  /**
   * Check for circular dependency
   *
   * @param parentItemId - Proposed parent item ID
   * @param childItemId - Proposed child item ID
   * @returns Circular dependency check result
   */
  async checkCircularDependency(
    parentItemId: string,
    childItemId: string
  ): Promise<CircularDependencyCheck> {
    return checkCircularDependency(parentItemId, childItemId)
  }

  /**
   * Check if an item has any parent-child relationships
   *
   * @param itemId - Item ID
   * @returns True if item has children or parents
   */
  async hasRelationships(itemId: string): Promise<boolean> {
    const result = await hasParentChildRelationships(itemId)
    return result.hasRelationships
  }

  /**
   * Remove all links for an item (cleanup utility)
   * Removes both parent and child relationships
   *
   * @param itemId - Item ID
   * @returns Count of removed links
   */
  async removeAllLinks(itemId: string): Promise<{
    data: { removed_count: number } | null
    error: string | null
  }> {
    try {
      // Get all relationships
      const summary = await getItemLinkSummary(itemId)

      if (summary.error || !summary.data) {
        return { data: null, error: summary.error }
      }

      let removedCount = 0

      // Remove all parent relationships (where this item is the child)
      for (const parent of summary.data.parents) {
        const result = await this.removeParentChildLink({
          parent_item_id: parent.id,
          child_item_id: itemId
        })

        if (result.data?.success) {
          removedCount++
        }
      }

      // Remove all child relationships (where this item is the parent)
      for (const child of summary.data.children) {
        const result = await this.removeParentChildLink({
          parent_item_id: itemId,
          child_item_id: child.id
        })

        if (result.data?.success) {
          removedCount++
        }
      }

      return {
        data: { removed_count: removedCount },
        error: null
      }
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error removing all links'
      }
    }
  }

  /**
   * Batch create multiple parent-child links
   * Validates all before creating any
   *
   * @param requests - Array of link creation requests
   * @returns Summary of successful and failed operations
   */
  async batchCreateLinks(requests: CreateParentChildLinkRequest[]): Promise<{
    data: {
      successful: number
      failed: number
      results: CreateParentChildLinkResponse[]
    } | null
    error: string | null
  }> {
    // Validate all requests first
    const validations = await Promise.all(
      requests.map((req) => validateLinkCreationLocal(req.parent_item_id, req.child_item_ids))
    )

    const hasErrors = validations.some((v) => !v.isValid)

    if (hasErrors) {
      const allErrors = validations
        .filter((v) => !v.isValid)
        .flatMap((v) => v.errors)
        .join('; ')

      return {
        data: null,
        error: `Validation failed: ${allErrors}`
      }
    }

    // All validations passed, create links
    return bulkCreateParentChildLinks(requests)
  }

  /**
   * Convert item from legacy bidirectional links to parent-child
   * Helper for migration scenarios
   *
   * @param itemId - Item ID to convert
   * @param childIds - Array of IDs to convert to children
   * @returns Conversion result
   */
  async convertLegacyToParentChild(
    itemId: string,
    childIds: string[]
  ): Promise<{
    data: CreateParentChildLinkResponse | null
    error: string | null
  }> {
    // Create parent-child links for all legacy links
    return this.createParentChildLinks({
      parent_item_id: itemId,
      child_item_ids: childIds
    })
  }

  /**
   * Get link statistics for an item
   * Useful for UI display and debugging
   *
   * @param itemId - Item ID
   * @returns Link statistics
   */
  async getLinkStatistics(itemId: string): Promise<{
    data: {
      is_parent: boolean
      is_child: boolean
      children_count: number
      parents_count: number
      total_relationships: number
      can_have_children: boolean
      can_have_parents: boolean
    } | null
    error: string | null
  }> {
    const summary = await getItemLinkSummary(itemId)

    if (summary.error || !summary.data) {
      return { data: null, error: summary.error }
    }

    return {
      data: {
        is_parent: summary.data.total_children > 0,
        is_child: summary.data.total_parents > 0,
        children_count: summary.data.total_children,
        parents_count: summary.data.total_parents,
        total_relationships: summary.data.total_children + summary.data.total_parents,
        can_have_children: summary.data.total_children < 50, // Max 50 per API contract
        can_have_parents: summary.data.total_parents < 50
      },
      error: null
    }
  }
}

// Singleton instance
export const enhancedLinkingService = new EnhancedLinkingService()