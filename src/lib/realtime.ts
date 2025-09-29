import { supabase } from './supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { List, Item, Share } from '../types'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

export interface RealtimeChangePayload<T = any> {
  eventType: RealtimeEvent
  new: T | null
  old: T | null
  table: string
  schema: string
}

export interface RealtimeSubscription {
  channel: RealtimeChannel
  unsubscribe: () => void
}

export class RealtimeManager {
  private channels = new Map<string, RealtimeChannel>()
  private subscriptions = new Map<string, Set<(payload: RealtimeChangePayload) => void>>()

  subscribeToLists(
    userId: string,
    callback: (payload: RealtimeChangePayload<List>) => void
  ): RealtimeSubscription {
    const channelName = `lists:${userId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lists',
            filter: `user_id=eq.${userId}`
          },
          (payload: RealtimePostgresChangesPayload<List>) => {
            this.handleChange('lists', payload)
          }
        )
        .subscribe()

      this.channels.set(channelName, channel)
      this.subscriptions.set(channelName, new Set())
    }

    // Add callback to subscription set
    const callbacks = this.subscriptions.get(channelName)!
    callbacks.add(callback as any)

    return {
      channel,
      unsubscribe: () => {
        callbacks.delete(callback as any)
        if (callbacks.size === 0) {
          this.unsubscribeChannel(channelName)
        }
      }
    }
  }

  subscribeToListItems(
    listId: string,
    callback: (payload: RealtimeChangePayload<Item>) => void
  ): RealtimeSubscription {
    const channelName = `items:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'items',
            filter: `list_id=eq.${listId}`
          },
          (payload: RealtimePostgresChangesPayload<Item>) => {
            this.handleChange('items', payload)
          }
        )
        .subscribe()

      this.channels.set(channelName, channel)
      this.subscriptions.set(channelName, new Set())
    }

    const callbacks = this.subscriptions.get(channelName)!
    callbacks.add(callback as any)

    return {
      channel,
      unsubscribe: () => {
        callbacks.delete(callback as any)
        if (callbacks.size === 0) {
          this.unsubscribeChannel(channelName)
        }
      }
    }
  }

  subscribeToSharedLists(
    userEmail: string,
    callback: (payload: RealtimeChangePayload<Share>) => void
  ): RealtimeSubscription {
    const channelName = `shares:${userEmail}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shares',
            filter: `shared_with_email=eq.${userEmail}`
          },
          (payload: RealtimePostgresChangesPayload<Share>) => {
            this.handleChange('shares', payload)
          }
        )
        .subscribe()

      this.channels.set(channelName, channel)
      this.subscriptions.set(channelName, new Set())
    }

    const callbacks = this.subscriptions.get(channelName)!
    callbacks.add(callback as any)

    return {
      channel,
      unsubscribe: () => {
        callbacks.delete(callback as any)
        if (callbacks.size === 0) {
          this.unsubscribeChannel(channelName)
        }
      }
    }
  }

  subscribeToListShares(
    listId: string,
    callback: (payload: RealtimeChangePayload<Share>) => void
  ): RealtimeSubscription {
    const channelName = `list-shares:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shares',
            filter: `list_id=eq.${listId}`
          },
          (payload: RealtimePostgresChangesPayload<Share>) => {
            this.handleChange('shares', payload)
          }
        )
        .subscribe()

      this.channels.set(channelName, channel)
      this.subscriptions.set(channelName, new Set())
    }

    const callbacks = this.subscriptions.get(channelName)!
    callbacks.add(callback as any)

    return {
      channel,
      unsubscribe: () => {
        callbacks.delete(callback as any)
        if (callbacks.size === 0) {
          this.unsubscribeChannel(channelName)
        }
      }
    }
  }

  private handleChange(table: string, payload: RealtimePostgresChangesPayload<any>): void {
    const changePayload: RealtimeChangePayload = {
      eventType: payload.eventType as RealtimeEvent,
      new: payload.new,
      old: payload.old,
      table,
      schema: payload.schema
    }

    // Find all channels that might be interested in this change
    for (const [channelName, callbacks] of this.subscriptions.entries()) {
      if (this.shouldNotifyChannel(channelName, table, changePayload)) {
        callbacks.forEach(callback => {
          try {
            callback(changePayload)
          } catch (error) {
            console.error('Error in realtime callback:', error)
          }
        })
      }
    }
  }

  private shouldNotifyChannel(channelName: string, table: string, _payload: RealtimeChangePayload): boolean {
    // Extract table and ID from channel name (e.g., "items:list-123" or "lists:user-456")
    const [channelTable] = channelName.split(':')

    switch (channelTable) {
      case 'lists':
        return table === 'lists'
      case 'items':
        return table === 'items'
      case 'shares':
      case 'list-shares':
        return table === 'shares'
      default:
        return false
    }
  }

  private unsubscribeChannel(channelName: string): void {
    const channel = this.channels.get(channelName)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelName)
      this.subscriptions.delete(channelName)
    }
  }

  unsubscribeAll(): void {
    for (const [channelName] of this.channels) {
      this.unsubscribeChannel(channelName)
    }
  }

  getChannelStatus(channelName: string): string | null {
    const channel = this.channels.get(channelName)
    return channel?.state || null
  }

  getAllChannels(): string[] {
    return Array.from(this.channels.keys())
  }

  // Presence tracking for collaborative features
  trackPresence(
    listId: string,
    userData: {
      user_id: string
      email: string
      display_name?: string
      cursor_position?: { x: number; y: number }
      last_seen?: string
    }
  ): RealtimeSubscription {
    const channelName = `presence:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: userData.user_id
          }
        }
      })

      this.channels.set(channelName, channel)
    }

    // Track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          ...userData,
          online_at: new Date().toISOString()
        })
      }
    })

    return {
      channel,
      unsubscribe: () => {
        channel.untrack()
        this.unsubscribeChannel(channelName)
      }
    }
  }

  subscribeToPresence(
    listId: string,
    callbacks: {
      onJoin?: (key: string, currentPresences: any, newPresences: any) => void
      onLeave?: (key: string, currentPresences: any, leftPresences: any) => void
      onSync?: () => void
    }
  ): RealtimeSubscription {
    const channelName = `presence:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: 'user'
          }
        }
      })
      this.channels.set(channelName, channel)
    }

    // Set up presence callbacks
    if (callbacks.onJoin) {
      channel.on('presence', { event: 'join' }, callbacks.onJoin)
    }
    if (callbacks.onLeave) {
      channel.on('presence', { event: 'leave' }, callbacks.onLeave)
    }
    if (callbacks.onSync) {
      channel.on('presence', { event: 'sync' }, callbacks.onSync)
    }

    channel.subscribe()

    return {
      channel,
      unsubscribe: () => {
        this.unsubscribeChannel(channelName)
      }
    }
  }

  getPresenceState(listId: string): Record<string, any[]> {
    const channelName = `presence:${listId}`
    const channel = this.channels.get(channelName)
    return channel?.presenceState() || {}
  }

  // Broadcast custom events for real-time collaboration
  broadcast(
    listId: string,
    event: string,
    payload: any
  ): Promise<'ok' | 'timed_out' | 'rate_limited'> {
    const channelName = `broadcast:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
      this.channels.set(channelName, channel)
      channel.subscribe()
    }

    return channel.send({
      type: 'broadcast',
      event,
      payload
    })
  }

  subscribeToBroadcast(
    listId: string,
    event: string,
    callback: (payload: any) => void
  ): RealtimeSubscription {
    const channelName = `broadcast:${listId}`

    let channel = this.channels.get(channelName)
    if (!channel) {
      channel = supabase.channel(channelName)
      this.channels.set(channelName, channel)
    }

    channel.on('broadcast', { event }, callback)
    channel.subscribe()

    return {
      channel,
      unsubscribe: () => {
        // Note: Supabase doesn't provide a way to remove specific event listeners
        // so we unsubscribe the entire channel
        this.unsubscribeChannel(channelName)
      }
    }
  }
}

export const realtimeManager = new RealtimeManager()

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  realtimeManager.unsubscribeAll()
})