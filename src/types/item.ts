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
}

export interface ItemHistory {
  id: string
  item_id: string
  content: string
  action: string
  created_at: string
}