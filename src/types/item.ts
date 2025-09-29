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
  linked_items?: string[]
}

export interface ItemHistory {
  id: string
  item_id: string
  content: string
  action: string
  created_at: string
}

export interface LinkedItemInfo {
  id: string
  list_id: string
  content: string
  is_completed: boolean
  list_title: string
  list_type: string
}

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