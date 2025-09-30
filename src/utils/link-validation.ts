/**
 * Link Validation Utilities
 * Client-side validation for parent-child link creation
 * Prevents circular dependencies and validates constraints
 */

import { supabase } from '../lib/supabase'
import type {
  CircularDependencyCheck,
  LinkValidationResult
} from '../types/enhanced-linking'
import { isEnhancedLinkedItems } from '../types/enhanced-linking'

/**
 * Check if creating a link would create a circular dependency
 * Uses depth-first search to detect cycles
 *
 * @param parentId - Proposed parent item ID
 * @param childId - Proposed child item ID
 * @returns Circular dependency check result
 */
export async function checkCircularDependency(
  parentId: string,
  childId: string
): Promise<CircularDependencyCheck> {
  try {
    // Self-link check
    if (parentId === childId) {
      return {
        hasCircularDependency: true,
        cycleChain: [parentId],
        message: 'Cannot link item to itself'
      }
    }

    // Check if child is already an ancestor of parent (would create cycle)
    const ancestorPath = await findAncestorPath(childId, parentId)

    if (ancestorPath.length > 0) {
      return {
        hasCircularDependency: true,
        cycleChain: [...ancestorPath, childId],
        message: `Circular dependency detected: ${ancestorPath.join(' → ')} → ${childId}`
      }
    }

    return {
      hasCircularDependency: false,
      message: 'No circular dependency detected'
    }
  } catch (error) {
    console.error('Error checking circular dependency:', error)
    return {
      hasCircularDependency: true, // Fail safe - assume circular
      message: 'Error validating circular dependency'
    }
  }
}

/**
 * Find path from startId to targetId through parent relationships
 * Returns array of IDs forming the path, empty if no path exists
 */
async function findAncestorPath(
  startId: string,
  targetId: string,
  visited: Set<string> = new Set(),
  path: string[] = []
): Promise<string[]> {
  // Prevent infinite loops
  if (visited.has(startId)) {
    return []
  }

  visited.add(startId)
  path.push(startId)

  // Found the target
  if (startId === targetId) {
    return path
  }

  // Get parents of current item
  const { data: item } = await supabase
    .from('items')
    .select('linked_items')
    .eq('id', startId)
    .single()

  if (!item || !item.linked_items) {
    return []
  }

  // Get parent IDs from linked_items
  const parentIds = getParentIds(item.linked_items)

  // Recursively check each parent
  for (const parentId of parentIds) {
    const result = await findAncestorPath(parentId, targetId, visited, [...path])
    if (result.length > 0) {
      return result
    }
  }

  return []
}

/**
 * Extract parent IDs from linked_items structure
 */
function getParentIds(linked_items: unknown): string[] {
  if (!linked_items) return []

  if (isEnhancedLinkedItems(linked_items)) {
    return linked_items.parents || []
  }

  // Legacy format has no parent concept
  return []
}

/**
 * Validate link creation with comprehensive checks
 *
 * @param parentId - Parent item ID
 * @param childIds - Array of child item IDs
 * @returns Validation result with errors and warnings
 */
export async function validateLinkCreationLocal(
  parentId: string,
  childIds: string[]
): Promise<LinkValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Empty array check
  if (childIds.length === 0) {
    warnings.push('No child items specified')
    return { isValid: true, errors, warnings }
  }

  // Maximum limit check (API contract specifies max 20)
  if (childIds.length > 20) {
    errors.push('Cannot link more than 20 items at once')
    return { isValid: false, errors, warnings }
  }

  // Check for self-links
  const selfLinks = childIds.filter((id) => id === parentId)
  if (selfLinks.length > 0) {
    errors.push('Cannot link item to itself')
  }

  // Check for duplicate child IDs
  const uniqueIds = new Set(childIds)
  if (uniqueIds.size !== childIds.length) {
    warnings.push('Duplicate child IDs detected, will be deduplicated')
  }

  // Check if parent exists
  const { data: parentItem, error: parentError } = await supabase
    .from('items')
    .select('id, list_id, linked_items')
    .eq('id', parentId)
    .single()

  if (parentError || !parentItem) {
    errors.push('Parent item not found')
    return { isValid: false, errors, warnings }
  }

  // Check total link count after addition
  const currentChildren = getChildIds(parentItem.linked_items)
  const newChildIds = Array.from(new Set([...currentChildren, ...childIds]))
  if (newChildIds.length > 50) {
    errors.push('Maximum 50 total linked items per item')
    return { isValid: false, errors, warnings }
  }

  // Check if children exist
  const { data: childItems, error: childError } = await supabase
    .from('items')
    .select('id, list_id')
    .in('id', childIds)

  if (childError) {
    errors.push('Error validating child items')
    return { isValid: false, errors, warnings }
  }

  const foundIds = new Set(childItems?.map((item) => item.id) || [])
  const missingIds = childIds.filter((id) => !foundIds.has(id))
  if (missingIds.length > 0) {
    warnings.push(`${missingIds.length} child item(s) not found and will be skipped`)
  }

  // Check for circular dependencies
  for (const childId of childIds) {
    if (foundIds.has(childId)) {
      const circularCheck = await checkCircularDependency(parentId, childId)
      if (circularCheck.hasCircularDependency) {
        errors.push(`Circular dependency: ${circularCheck.message}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Extract child IDs from linked_items structure
 */
function getChildIds(linked_items: unknown): string[] {
  if (!linked_items) return []

  if (isEnhancedLinkedItems(linked_items)) {
    return linked_items.children || []
  }

  // Legacy format has no child concept
  return []
}

/**
 * Validate removal of a link
 */
export async function validateLinkRemoval(
  parentId: string,
  childId: string
): Promise<LinkValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if parent exists
  const { data: parentItem, error: parentError } = await supabase
    .from('items')
    .select('id, linked_items')
    .eq('id', parentId)
    .single()

  if (parentError || !parentItem) {
    errors.push('Parent item not found')
    return { isValid: false, errors, warnings }
  }

  // Check if child exists
  const { data: childItem, error: childError } = await supabase
    .from('items')
    .select('id, linked_items')
    .eq('id', childId)
    .single()

  if (childError || !childItem) {
    errors.push('Child item not found')
    return { isValid: false, errors, warnings }
  }

  // Check if link exists
  const parentChildren = getChildIds(parentItem.linked_items)
  const childParents = getParentIds(childItem.linked_items)

  if (!parentChildren.includes(childId) && !childParents.includes(parentId)) {
    warnings.push('Link does not exist between these items')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate status propagation constraints
 */
export async function validateStatusPropagation(
  itemId: string,
  newStatus: boolean
): Promise<LinkValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if item exists
  const { data: item, error } = await supabase
    .from('items')
    .select('id, is_completed, linked_items')
    .eq('id', itemId)
    .single()

  if (error || !item) {
    errors.push('Item not found')
    return { isValid: false, errors, warnings }
  }

  // Check if status is actually changing
  if (item.is_completed === newStatus) {
    warnings.push('Status is not changing')
  }

  // Only propagation from completed → todo has effects
  if (item.is_completed === true && newStatus === false) {
    const childIds = getChildIds(item.linked_items)
    if (childIds.length === 0) {
      warnings.push('No children to propagate to')
    } else {
      warnings.push(`Will reset ${childIds.length} completed child item(s) to todo`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get maximum depth of link hierarchy from an item
 * Useful for detecting deeply nested structures
 */
export async function getHierarchyDepth(
  itemId: string,
  visited: Set<string> = new Set()
): Promise<number> {
  if (visited.has(itemId)) {
    return 0 // Circular reference
  }

  visited.add(itemId)

  const { data: item } = await supabase
    .from('items')
    .select('linked_items')
    .eq('id', itemId)
    .single()

  if (!item || !item.linked_items) {
    return 0
  }

  const childIds = getChildIds(item.linked_items)
  if (childIds.length === 0) {
    return 0
  }

  // Get max depth of all children
  const depths = await Promise.all(
    childIds.map((childId) => getHierarchyDepth(childId, new Set(visited)))
  )

  return 1 + Math.max(...depths, 0)
}

/**
 * Find all items that would be affected by status propagation
 */
export async function findPropagationAffectedItems(
  itemId: string,
  newStatus: boolean
): Promise<string[]> {
  // Only propagation from completed → todo affects children
  if (newStatus === true) {
    return [] // Completing parent doesn't affect children
  }

  const { data: item } = await supabase
    .from('items')
    .select('linked_items')
    .eq('id', itemId)
    .single()

  if (!item || !item.linked_items) {
    return []
  }

  const childIds = getChildIds(item.linked_items)

  // Get completed children
  const { data: children } = await supabase
    .from('items')
    .select('id, is_completed')
    .in('id', childIds)

  return (children || [])
    .filter((child) => child.is_completed === true)
    .map((child) => child.id)
}