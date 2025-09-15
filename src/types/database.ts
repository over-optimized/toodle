export type ListType = 'simple' | 'grocery' | 'countdown'
export type ShareRole = 'read' | 'write'

export interface User {
  id: string
  email: string
  display_name?: string
  created_at: string
  updated_at: string
}

export interface List {
  id: string
  user_id: string
  type: ListType
  title: string
  is_private: boolean
  created_at: string
  updated_at: string
}

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

export interface Share {
  id: string
  list_id: string
  shared_by: string
  shared_with_email: string
  role: ShareRole
  expires_at: string
  created_at: string
}

export interface ItemHistory {
  id: string
  item_id: string
  content: string
  action: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      lists: {
        Row: List
        Insert: Omit<List, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<List, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      items: {
        Row: Item
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Item, 'id' | 'list_id' | 'created_at' | 'updated_at'>>
      }
      shares: {
        Row: Share
        Insert: Omit<Share, 'id' | 'created_at'>
        Update: Partial<Omit<Share, 'id' | 'created_at'>>
      }
      item_history: {
        Row: ItemHistory
        Insert: Omit<ItemHistory, 'id' | 'created_at'>
        Update: never
      }
    }
  }
}