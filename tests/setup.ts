// Global test setup and utilities for memory-efficient testing
import { afterEach, beforeEach } from 'vitest'
import { supabase } from '../src/lib/supabase'

// Track active Supabase subscriptions for cleanup
const activeSubscriptions = new Set<ReturnType<typeof supabase.channel>>()

// Track active timers for cleanup
const activeTimers = new Set<NodeJS.Timeout>()

// Enhanced setTimeout that tracks timers for cleanup
export const trackedSetTimeout = (
  callback: () => void,
  ms: number
): NodeJS.Timeout => {
  const timer = setTimeout(() => {
    activeTimers.delete(timer)
    callback()
  }, ms)
  activeTimers.add(timer)
  return timer
}

// Cleanup helper for Supabase channels
export const cleanupSupabaseChannel = (
  channel: ReturnType<typeof supabase.channel>
) => {
  activeSubscriptions.add(channel)
  return channel
}

// Global afterEach to ensure cleanup
afterEach(async () => {
  // Clear all active timers
  for (const timer of activeTimers) {
    clearTimeout(timer)
  }
  activeTimers.clear()

  // Unsubscribe from all active channels
  for (const subscription of activeSubscriptions) {
    await subscription.unsubscribe()
  }
  activeSubscriptions.clear()

  // Force garbage collection hint (V8 will collect when ready)
  if (global.gc) {
    global.gc()
  }
})

// Helper to create test data with automatic cleanup tracking
export const createTestIds = () => {
  const ids = {
    users: [] as string[],
    lists: [] as string[],
    items: [] as string[],
  }

  const cleanup = async () => {
    // Delete in reverse dependency order
    if (ids.items.length > 0) {
      await supabase.from('items').delete().in('id', ids.items)
    }
    if (ids.lists.length > 0) {
      await supabase.from('lists').delete().in('id', ids.lists)
    }
    if (ids.users.length > 0) {
      await supabase.from('users').delete().in('id', ids.users)
    }
  }

  return { ids, cleanup }
}

// Memory-efficient delay helper (with automatic cleanup)
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    const timer = trackedSetTimeout(resolve, ms)
  })
}

// Mock IndexedDB with memory limits
export class MemoryEfficientMockIDB {
  private data: Map<string, any> = new Map()
  private maxSize = 1000 // Limit to 1000 entries

  async get(key: string) {
    return this.data.get(key)
  }

  async set(key: string, value: any) {
    // Enforce memory limits
    if (this.data.size >= this.maxSize && !this.data.has(key)) {
      // Remove oldest entry (FIFO)
      const firstKey = this.data.keys().next().value
      this.data.delete(firstKey)
    }
    this.data.set(key, value)
  }

  async delete(key: string) {
    this.data.delete(key)
  }

  async keys() {
    return Array.from(this.data.keys())
  }

  async clear() {
    this.data.clear()
  }

  // Get current size for monitoring
  size() {
    return this.data.size
  }
}