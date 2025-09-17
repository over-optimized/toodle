import { supabase } from '../lib/supabase'
import type {
  Item,
  CreateItemRequest,
  UpdateItemRequest
} from '../types'

export class ItemService {
  async createItem(listId: string, request: CreateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      const position = request.position ?? await this.getNextItemPosition(listId)

      const { data, error } = await (supabase as any)
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

  async getItemsByListId(listId: string): Promise<{ data: Item[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('position')

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async reorderItems(listId: string, itemIds: string[]): Promise<{ error: string | null }> {
    try {
      // Update positions for all items in the list
      const updates = itemIds.map((itemId, index) => ({
        id: itemId,
        position: index + 1
      }))

      for (const update of updates) {
        const { error } = await (supabase as any)
          .from('items')
          .update({ position: update.position })
          .eq('id', update.id)
          .eq('list_id', listId)

        if (error) {
          return { error: error.message }
        }
      }

      return { error: null }
    } catch (error) {
      return {
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

export const itemService = new ItemService()