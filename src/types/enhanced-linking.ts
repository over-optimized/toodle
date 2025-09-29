/**
 * Enhanced Cross-List Linking Type Definitions
 * Supports parent-child hierarchical relationships with status propagation
 */

import type { Item } from './item'

// Enhanced linked_items structure (already defined in item.ts, re-exported here for clarity)
export interface EnhancedLinkedItems {
  children?: string[]      // Items this item is a parent of (controls these items)
  parents?: string[]       // Items this item is a child of (controlled by these items)
  bidirectional?: string[] // Non-hierarchical informational links (legacy/peer links)
}

// RPC Request/Response Types

/**
 * Request to create parent-child links
 * Maps to create_parent_child_link RPC
 */
export interface CreateParentChildLinkRequest {
  parent_item_id: string
  child_item_ids: string[] // Max 20 items per API contract
}

/**
 * Response from create_parent_child_link RPC
 */
export interface CreateParentChildLinkResponse {
  success: boolean
  links_created: number
  warnings?: string[]
  error?: string
}

/**
 * Request to remove parent-child link
 * Maps to remove_parent_child_link RPC
 */
export interface RemoveParentChildLinkRequest {
  parent_item_id: string
  child_item_id: string
}

/**
 * Response from remove_parent_child_link RPC
 */
export interface RemoveParentChildLinkResponse {
  success: boolean
  error?: string
}

/**
 * Request to validate link creation
 * Maps to validate_link_creation RPC
 */
export interface ValidateLinkCreationRequest {
  parent_item_id: string
  child_item_ids: string[]
}

/**
 * Response from validate_link_creation RPC
 */
export interface ValidateLinkCreationResponse {
  is_valid: boolean
  valid_links: string[]
  invalid_links: Array<{
    child_id: string
    reason: 'self_link' | 'circular' | 'not_found' | 'cross_user' | 'max_limit'
  }>
  warnings: string[]
}

/**
 * Request to get child items
 * Maps to get_child_items RPC
 */
export interface GetChildItemsRequest {
  parent_item_id: string
}

/**
 * Request to get parent items
 * Maps to get_parent_items RPC
 */
export interface GetParentItemsRequest {
  child_item_id: string
}

/**
 * Enhanced item info returned by get_child_items and get_parent_items
 */
export interface LinkedItemInfo {
  id: string
  list_id: string
  content: string
  is_completed: boolean
  list_title: string
  list_type: 'simple' | 'grocery' | 'countdown'
}

/**
 * Request to update item with status propagation
 * Enhanced PATCH items endpoint
 */
export interface UpdateItemWithPropagationRequest {
  item_id: string
  new_content?: string
  new_is_completed?: boolean
  new_target_date?: string
  new_position?: number
  new_linked_items?: EnhancedLinkedItems
}

/**
 * Response from update_item_with_propagation RPC
 */
export interface UpdateItemWithPropagationResponse {
  success: boolean
  item?: Item
  propagated_updates?: Array<{
    item_id: string
    old_status: boolean
    new_status: boolean
    content: string
  }>
  update_count?: number
  error?: string
}

/**
 * Request to preview status propagation
 * Maps to preview_status_propagation RPC
 */
export interface PreviewStatusPropagationRequest {
  item_id: string
  new_status: boolean
}

/**
 * Response from preview_status_propagation RPC
 */
export interface PreviewStatusPropagationResponse {
  would_propagate: boolean
  affected_count: number
  affected_items: Array<{
    item_id: string
    content: string
    current_status: 'completed' | 'todo'
    new_status: 'completed' | 'todo'
  }>
  message?: string
}

// Helper Types for Application Logic

/**
 * Link direction for UI display
 */
export type LinkDirection = 'parent' | 'child' | 'bidirectional'

/**
 * Link relationship metadata
 */
export interface LinkRelationship {
  item_id: string
  direction: LinkDirection
  item: LinkedItemInfo
}

/**
 * Complete link summary for an item
 */
export interface ItemLinkSummary {
  item_id: string
  total_links: number
  children_count: number
  parents_count: number
  bidirectional_count: number
  children: LinkedItemInfo[]
  parents: LinkedItemInfo[]
  bidirectional: LinkedItemInfo[]
}

/**
 * Status propagation event
 * Used for real-time updates
 */
export interface StatusPropagationEvent {
  parent_item_id: string
  affected_items: Array<{
    item_id: string
    list_id: string
    old_status: boolean
    new_status: boolean
  }>
  timestamp: string
}

/**
 * Link validation result for UI
 */
export interface LinkValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Circular dependency check result
 */
export interface CircularDependencyCheck {
  hasCircularDependency: boolean
  cycleChain?: string[] // Array of item IDs forming the cycle
  message: string
}

/**
 * Helper type guards
 */
export function isEnhancedLinkedItems(linked_items: unknown): linked_items is EnhancedLinkedItems {
  if (!linked_items || typeof linked_items !== 'object') return false
  const obj = linked_items as Record<string, unknown>
  return (
    ('children' in obj && Array.isArray(obj.children)) ||
    ('parents' in obj && Array.isArray(obj.parents)) ||
    ('bidirectional' in obj && Array.isArray(obj.bidirectional))
  )
}

export function isLegacyLinkedItems(linked_items: unknown): linked_items is string[] {
  return Array.isArray(linked_items) && linked_items.every((item) => typeof item === 'string')
}

/**
 * Convert legacy array format to enhanced object format
 */
export function migrateLegacyLinks(legacy: string[]): EnhancedLinkedItems {
  return {
    bidirectional: legacy,
    children: [],
    parents: []
  }
}

/**
 * Get all linked item IDs from enhanced structure
 */
export function getAllLinkedIds(linked_items?: string[] | EnhancedLinkedItems): string[] {
  if (!linked_items) return []

  if (isLegacyLinkedItems(linked_items)) {
    return linked_items
  }

  if (isEnhancedLinkedItems(linked_items)) {
    return [
      ...(linked_items.children || []),
      ...(linked_items.parents || []),
      ...(linked_items.bidirectional || [])
    ]
  }

  return []
}

/**
 * Check if item has any links
 */
export function hasAnyLinks(linked_items?: string[] | EnhancedLinkedItems): boolean {
  return getAllLinkedIds(linked_items).length > 0
}

/**
 * Check if item is a parent (has children)
 */
export function isParent(linked_items?: string[] | EnhancedLinkedItems): boolean {
  if (!linked_items || isLegacyLinkedItems(linked_items)) return false
  return isEnhancedLinkedItems(linked_items) && (linked_items.children?.length || 0) > 0
}

/**
 * Check if item is a child (has parents)
 */
export function isChild(linked_items?: string[] | EnhancedLinkedItems): boolean {
  if (!linked_items || isLegacyLinkedItems(linked_items)) return false
  return isEnhancedLinkedItems(linked_items) && (linked_items.parents?.length || 0) > 0
}

/**
 * Get link count by direction
 */
export function getLinkCounts(linked_items?: string[] | EnhancedLinkedItems): {
  children: number
  parents: number
  bidirectional: number
  total: number
} {
  if (!linked_items) {
    return { children: 0, parents: 0, bidirectional: 0, total: 0 }
  }

  if (isLegacyLinkedItems(linked_items)) {
    return {
      children: 0,
      parents: 0,
      bidirectional: linked_items.length,
      total: linked_items.length
    }
  }

  if (isEnhancedLinkedItems(linked_items)) {
    const children = linked_items.children?.length || 0
    const parents = linked_items.parents?.length || 0
    const bidirectional = linked_items.bidirectional?.length || 0
    return {
      children,
      parents,
      bidirectional,
      total: children + parents + bidirectional
    }
  }

  return { children: 0, parents: 0, bidirectional: 0, total: 0 }
}