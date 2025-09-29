import { supabase } from '../lib/supabase'
import type {
  Share,
  CreateShareRequest
} from '../types'

export class ShareService {
  async createShare(listId: string, request: CreateShareRequest): Promise<{ data: Share | null; error: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: 'User not authenticated' }
      }

      const { data, error } = await (supabase as any)
        .from('shares')
        .insert({
          list_id: listId,
          created_by: user.id,
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

  async getShare(shareId: string): Promise<{ data: Share | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('id', shareId)
        .single()

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getSharesForList(listId: string): Promise<{ data: Share[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getSharesForUser(userEmail: string): Promise<{ data: Share[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .eq('shared_with_email', userEmail)
        .order('created_at', { ascending: false })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async deleteShare(shareId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('shares')
        .delete()
        .eq('id', shareId)

      return { error: error?.message || null }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async revokeShare(shareId: string): Promise<{ error: string | null }> {
    return this.deleteShare(shareId)
  }

  async getShares(): Promise<{ data: Share[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('*')
        .order('created_at', { ascending: false })

      return { data, error: error?.message || null }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async updateShareRole(shareId: string, role: 'read' | 'edit'): Promise<{ data: Share | null; error: string | null }> {
    try {
      const { data, error } = await (supabase as any)
        .from('shares')
        .update({ role })
        .eq('id', shareId)
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

  async checkExpiredShares(): Promise<{ deletedCount: number; error: string | null }> {
    try {
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('shares')
        .delete()
        .lt('expires_at', now)
        .select('id')

      if (error) {
        return { deletedCount: 0, error: error.message }
      }

      return { deletedCount: data?.length || 0, error: null }
    } catch (error) {
      return {
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async isShareValid(shareId: string): Promise<{ isValid: boolean; share: Share | null; error: string | null }> {
    try {
      const { data: share, error } = await supabase
        .from('shares')
        .select('*')
        .eq('id', shareId)
        .single()

      if (error || !share) {
        return { isValid: false, share: null, error: error?.message || 'Share not found' }
      }

      const now = new Date()
      const expiresAt = new Date((share as Share).expires_at)
      const isValid = expiresAt > now

      return { isValid, share: isValid ? (share as Share) : null, error: null }
    } catch (error) {
      return {
        isValid: false,
        share: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const shareService = new ShareService()