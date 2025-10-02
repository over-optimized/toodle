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
      create_parent_child_link: {
        Args: { parent_item_id: string; child_item_ids: string[] }
        Returns: {
          success: boolean
          links_created: number
          error: string | null
          warnings: string[]
        }
      }
      remove_parent_child_link: {
        Args: { parent_item_id: string; child_item_id: string }
        Returns: {
          success: boolean
          error: string | null
        }
      }
      validate_link_creation: {
        Args: { parent_item_id: string; child_item_ids: string[] }
        Returns: {
          valid_links: string[]
          invalid_links: { child_id: string; reason: string }[]
          warnings: string[]
        }
      }
      get_child_items: {
        Args: { parent_item_id: string }
        Returns: {
          id: string
          content: string
          is_completed: boolean
          list_id: string
          list_title: string
          list_type: ListType
        }[]
      }
      get_parent_items: {
        Args: { child_item_id: string }
        Returns: {
          id: string
          content: string
          is_completed: boolean
          list_id: string
          list_title: string
          list_type: ListType
        }[]
      }
      update_item_with_propagation: {
        Args: {
          item_id: string
          new_content: string | null
          new_is_completed: boolean | null
          new_target_date: string | null
          new_position: number | null
          new_linked_items: any | null
        }
        Returns: {
          success: boolean
          updated_item: Item
          propagated_updates: { item_id: string; old_status: boolean; new_status: boolean }[]
          affected_list_ids: string[]
        }
      }
      preview_status_propagation: {
        Args: { item_id: string; new_status: boolean }
        Returns: {
          affected_items: { item_id: string; current_status: boolean; new_status: boolean }[]
          affected_count: number
        }
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