import { supabase } from '../lib/supabase'
import type {
  List,
  CreateListRequest,
  UpdateListRequest,
  ListWithItems,
  Database
} from '../types'

export class ListService {
  async getLists(): Promise<{ data: List[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .order('updated_at', { ascending: false })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getList(id: string): Promise<{ data: ListWithItems | null; error: string | null }> {
    try {
      const { data: list, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', id)
        .single()

      if (listError || !list) {
        return { data: null, error: listError?.message || 'List not found' }
      }

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', id)
        .order('position')

      if (itemsError) {
        return { data: null, error: itemsError.message }
      }

      return {
        data: { ...(list as List), items: items || [] },
        error: null
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async createList(request: CreateListRequest): Promise<{ data: List | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: 'User not authenticated' }
      }

      const listInsert: Database['public']['Tables']['lists']['Insert'] = {
        user_id: user.id,
        title: request.title,
        type: request.type,
        is_private: request.is_private ?? true
      }

      const { data, error } = await (supabase as any)
        .from('lists')
        .insert(listInsert as any)
        .select()
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async updateList(id: string, request: UpdateListRequest): Promise<{ data: List | null; error: string | null }> {
    try {
      const { data, error } = await (supabase as any)
        .from('lists')
        .update(request)
        .eq('id', id)
        .select()
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async deleteList(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', id)

      return { error: error?.message || null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const listService = new ListService()