import { supabase } from '../lib/supabase'
import type {
  List,
  Item,
  Share,
  CreateListRequest,
  UpdateListRequest,
  CreateItemRequest,
  UpdateItemRequest,
  CreateShareRequest,
  ListWithItems,
  Database
} from '../types'

export class ApiService {
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

      const { data, error } = await supabase
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

  async createItem(listId: string, request: CreateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      const position = request.position ?? await this.getNextItemPosition(listId)

      const { data, error } = await supabase
        .from('items')
        .insert({
          list_id: listId,
          content: request.content,
          position,
          target_date: request.target_date,
          is_completed: false
        } as any)
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

  async updateItem(id: string, request: UpdateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      const updateData: any = { ...request }
      
      if (request.is_completed !== undefined && request.is_completed) {
        updateData.completed_at = new Date().toISOString()
      } else if (request.is_completed === false) {
        updateData.completed_at = null
      }

      const { data, error } = await (supabase as any)
        .from('items')
        .update(updateData as any)
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

  async deleteItem(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)

      return { error: error?.message || null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async createShare(listId: string, request: CreateShareRequest): Promise<{ data: Share | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: 'User not authenticated' }
      }

      const { data, error } = await supabase
        .from('shares')
        .insert({
          list_id: listId,
          shared_by: user.id,
          shared_with_email: request.shared_with_email,
          role: request.role,
          expires_at: request.expires_at
        } as any)
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

  private async getNextItemPosition(listId: string): Promise<number> {
    const { data } = await supabase
      .from('items')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1)

    return ((data as any)?.[0]?.position || 0) + 1
  }
}

export const apiService = new ApiService()