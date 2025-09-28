import type { User } from './user'
import type { List, ListType } from './list'
import type { Item, ItemHistory } from './item'
import type { Share, ShareRole } from './share'

export type { User, List, ListType, Item, ItemHistory, Share, ShareRole }

export type Database = {
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
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_items_linking_to: {
        Args: { target_item_id: string }
        Returns: {
          id: string
          list_id: string
          content: string
          list_title: string
          list_type: ListType
        }[]
      }
      get_linked_items_info: {
        Args: { source_item_id: string }
        Returns: {
          id: string
          list_id: string
          content: string
          is_completed: boolean
          list_title: string
          list_type: ListType
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}