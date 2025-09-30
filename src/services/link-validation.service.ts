import { enhancedLinkingService } from './enhanced-linking.service'
import { statusPropagationService } from './status-propagation.service'
import {
  checkCircularDependency,
  validateLinkCreationLocal,
  validateLinkRemoval,
  findPropagationAffectedItems
} from '../utils/link-validation'
import type {
  CircularDependencyCheck,
  LinkValidationResult,
  LinkRemovalValidationResult,
  PropagationPreview
} from '../types/enhanced-linking'

/**
 * Link Validation Service
 *
 * Facade service that provides a unified interface for all link validation operations.
 * Wraps both client-side validation utilities and server-side validation services.
 */
export class LinkValidationService {
  /**
   * Check if creating a link would create a circular dependency
   */
  async checkCircularDependency(
    parentId: string,
    childId: string
  ): Promise<CircularDependencyCheck> {
    return checkCircularDependency(parentId, childId)
  }

  /**
   * Validate link creation with comprehensive checks
   * Includes circular dependency, self-link, max links, and existence validation
   */
  async validateLinkCreation(
    parentId: string,
    childIds: string[]
  ): Promise<LinkValidationResult> {
    return validateLinkCreationLocal(parentId, childIds)
  }

  /**
   * Validate link removal
   */
  async validateLinkRemoval(
    parentId: string,
    childId: string
  ): Promise<LinkRemovalValidationResult> {
    return validateLinkRemoval(parentId, childId)
  }

  /**
   * Find items that would be affected by status propagation
   */
  async findPropagationAffectedItems(
    itemId: string,
    newStatus: boolean
  ): Promise<PropagationPreview> {
    return findPropagationAffectedItems(itemId, newStatus)
  }

  /**
   * Check if item has any relationships that would prevent deletion
   */
  async checkDeletionImpact(itemId: string): Promise<{
    canDelete: boolean
    affectedItems: string[]
    warnings: string[]
  }> {
    const { data: summary } = await enhancedLinkingService.getLinkSummary(itemId)

    if (!summary) {
      return {
        canDelete: true,
        affectedItems: [],
        warnings: []
      }
    }

    const affectedItems: string[] = []
    const warnings: string[] = []

    if (summary.children_count > 0) {
      affectedItems.push(...summary.children)
      warnings.push(`This item has ${summary.children_count} child item(s) that will be unlinked.`)
    }

    if (summary.parents_count > 0) {
      affectedItems.push(...summary.parents)
      warnings.push(`This item is a child of ${summary.parents_count} parent item(s) that will be updated.`)
    }

    if (summary.bidirectional_count > 0) {
      affectedItems.push(...summary.bidirectional)
      warnings.push(`This item has ${summary.bidirectional_count} bidirectional link(s) that will be removed.`)
    }

    return {
      canDelete: true, // Deletion always allowed, just with warnings
      affectedItems: [...new Set(affectedItems)],
      warnings
    }
  }

  /**
   * Validate status change and return propagation preview
   */
  async validateStatusChange(
    itemId: string,
    newStatus: boolean
  ): Promise<{
    isValid: boolean
    wouldPropagate: boolean
    affectedCount: number
    preview?: PropagationPreview
    errors: string[]
  }> {
    try {
      // Check if status change would trigger propagation
      const wouldPropagate = await statusPropagationService.wouldPropagate(itemId, newStatus)

      if (!wouldPropagate) {
        return {
          isValid: true,
          wouldPropagate: false,
          affectedCount: 0,
          errors: []
        }
      }

      // Get preview of affected items
      const preview = await findPropagationAffectedItems(itemId, newStatus)

      return {
        isValid: true,
        wouldPropagate: true,
        affectedCount: preview.affected_items.length,
        preview,
        errors: []
      }
    } catch (error) {
      return {
        isValid: false,
        wouldPropagate: false,
        affectedCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Batch validate multiple link creations
   */
  async batchValidateLinkCreation(
    requests: Array<{ parentId: string; childIds: string[] }>
  ): Promise<Array<LinkValidationResult & { parentId: string }>> {
    const results = await Promise.all(
      requests.map(async ({ parentId, childIds }) => {
        const validation = await this.validateLinkCreation(parentId, childIds)
        return { ...validation, parentId }
      })
    )

    return results
  }

  /**
   * Check if an item can be moved between lists
   * Validates that moving won't break parent-child relationships
   */
  async validateItemMove(
    itemId: string,
    targetListId: string
  ): Promise<{
    canMove: boolean
    warnings: string[]
    errors: string[]
  }> {
    const { data: summary } = await enhancedLinkingService.getLinkSummary(itemId)

    if (!summary) {
      return {
        canMove: true,
        warnings: [],
        errors: []
      }
    }

    const warnings: string[] = []
    const errors: string[] = []

    // Check if item has parent-child relationships
    if (summary.children_count > 0) {
      warnings.push(
        `Moving this item will maintain its ${summary.children_count} child link(s), ` +
        'which may be in different lists.'
      )
    }

    if (summary.parents_count > 0) {
      warnings.push(
        `Moving this item will maintain its ${summary.parents_count} parent link(s), ` +
        'which may be in different lists.'
      )
    }

    // Cross-list parent-child relationships are allowed but warned about
    return {
      canMove: true,
      warnings,
      errors
    }
  }

  /**
   * Get comprehensive validation summary for an item
   */
  async getItemValidationSummary(itemId: string): Promise<{
    hasRelationships: boolean
    childrenCount: number
    parentsCount: number
    bidirectionalCount: number
    canDelete: boolean
    deletionWarnings: string[]
    canMove: boolean
    moveWarnings: string[]
  }> {
    const { data: summary } = await enhancedLinkingService.getLinkSummary(itemId)
    const deletionCheck = await this.checkDeletionImpact(itemId)
    const moveCheck = await this.validateItemMove(itemId, '') // Empty list ID for general check

    return {
      hasRelationships: summary ? (
        summary.children_count > 0 ||
        summary.parents_count > 0 ||
        summary.bidirectional_count > 0
      ) : false,
      childrenCount: summary?.children_count || 0,
      parentsCount: summary?.parents_count || 0,
      bidirectionalCount: summary?.bidirectional_count || 0,
      canDelete: deletionCheck.canDelete,
      deletionWarnings: deletionCheck.warnings,
      canMove: moveCheck.canMove,
      moveWarnings: moveCheck.warnings
    }
  }
}

export const linkValidationService = new LinkValidationService()