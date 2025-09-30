// Import from enhanced-linking to avoid duplicate exports
import type { EnhancedLinkedItems, LinkedItemInfo } from './enhanced-linking'

export interface Item {
  id: string
  list_id: string
  content: string
  is_completed: boolean
  position: number
  target_date?: string
  completed_at?: string
  created_at: string
  updated_at: string
  // Support both legacy array format and new object format
  linked_items?: string[] | EnhancedLinkedItems
}

export interface ItemHistory {
  id: string
  item_id: string
  content: string
  action: string
  created_at: string
}

// LinkedItemInfo is exported from enhanced-linking.ts to avoid duplicates

export interface ItemLinkingSummary {
  totalLinkedTo: number
  totalLinkingFrom: number
  linkedToItems: LinkedItemInfo[]
  linkingFromItems: LinkedItemInfo[]
}

export interface LinkingValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface BulkLinkOperation {
  sourceItemId: string
  targetItemIds: string[]
  operation: 'add' | 'remove' | 'replace'
}