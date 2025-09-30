/**
 * Performance Optimization Utilities
 * Utilities for optimizing rendering and operations for large link chains
 */

import { useCallback, useRef, useEffect } from 'react'

/**
 * Debounce function for expensive operations
 * Useful for search/filter operations in link management
 *
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Throttle function for rate-limiting expensive operations
 * Useful for realtime updates and scroll events
 *
 * @param func - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  let lastResult: ReturnType<T>

  return function throttled(...args: Parameters<T>): ReturnType<T> {
    if (!inThrottle) {
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
      lastResult = func(...args)
    }
    return lastResult
  }
}

/**
 * React hook for debounced value
 * Useful for search inputs in link management
 *
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * React hook for throttled callback
 * Useful for scroll handlers and resize events
 *
 * @param callback - Callback to throttle
 * @param delay - Minimum time between calls
 * @returns Throttled callback
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttledRef = useRef<T>()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  if (!throttledRef.current) {
    throttledRef.current = throttle((...args: Parameters<T>) => {
      return callbackRef.current(...args)
    }, delay) as T
  }

  return throttledRef.current
}

/**
 * Memoization utility for expensive computations
 * Creates a cache for function results based on arguments
 *
 * @param fn - Function to memoize
 * @param keyGenerator - Optional function to generate cache key
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Batch updates to reduce re-renders
 * Collects updates and applies them in a single batch
 *
 * @param callback - Function to call with batched updates
 * @param delay - Delay before applying batch
 * @returns Function to queue updates
 */
export function createBatcher<T>(
  callback: (items: T[]) => void,
  delay: number = 50
): (item: T) => void {
  let batch: T[] = []
  let timeoutId: NodeJS.Timeout | null = null

  return (item: T) => {
    batch.push(item)

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      callback(batch)
      batch = []
      timeoutId = null
    }, delay)
  }
}

/**
 * Calculate the depth of a link hierarchy
 * Used to warn users about deeply nested structures that may impact performance
 *
 * @param itemId - Root item ID
 * @param getChildren - Function to get children of an item
 * @param maxDepth - Maximum depth to calculate (prevents infinite loops)
 * @returns Depth of the hierarchy
 */
export async function calculateHierarchyDepth(
  itemId: string,
  getChildren: (id: string) => Promise<string[]>,
  maxDepth: number = 10
): Promise<number> {
  const visited = new Set<string>()

  async function traverse(id: string, depth: number): Promise<number> {
    if (depth >= maxDepth || visited.has(id)) {
      return depth
    }

    visited.add(id)
    const children = await getChildren(id)

    if (children.length === 0) {
      return depth
    }

    const childDepths = await Promise.all(
      children.map((childId) => traverse(childId, depth + 1))
    )

    return Math.max(...childDepths)
  }

  return traverse(itemId, 0)
}

/**
 * Chunk array for batch processing
 * Useful for processing large numbers of linked items without blocking UI
 *
 * @param array - Array to chunk
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Process large arrays in chunks with delays between chunks
 * Prevents UI blocking when processing many items
 *
 * @param items - Items to process
 * @param processor - Function to process each item
 * @param chunkSize - Number of items per chunk
 * @param delay - Delay between chunks in ms
 * @returns Promise that resolves when all items are processed
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R | Promise<R>,
  chunkSize: number = 10,
  delay: number = 10
): Promise<R[]> {
  const results: R[] = []
  const chunks = chunk(items, chunkSize)

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processor))
    results.push(...chunkResults)

    // Yield to browser between chunks
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return results
}

/**
 * Virtual scrolling helper
 * Calculates which items should be visible in a scrollable container
 *
 * @param scrollTop - Current scroll position
 * @param containerHeight - Height of visible container
 * @param itemHeight - Height of each item
 * @param totalItems - Total number of items
 * @param overscan - Number of items to render outside visible area
 * @returns Start and end indices for visible items
 */
export function getVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 3
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const end = Math.min(totalItems, start + visibleCount + overscan * 2)

  return { start, end }
}

/**
 * Intersection Observer hook for lazy loading
 * Useful for loading link details only when visible
 *
 * @param callback - Function to call when element is visible
 * @param options - Intersection Observer options
 * @returns Ref to attach to element
 */
export function useIntersectionObserver(
  callback: () => void,
  options?: IntersectionObserverInit
): (node: Element | null) => void {
  const observer = useRef<IntersectionObserver>()

  const ref = useCallback(
    (node: Element | null) => {
      if (observer.current) {
        observer.current.disconnect()
      }

      if (node) {
        observer.current = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              callback()
            }
          },
          options
        )
        observer.current.observe(node)
      }
    },
    [callback, options]
  )

  return ref
}

/**
 * Performance monitoring utility
 * Tracks timing of operations for optimization
 *
 * @param label - Label for the operation
 * @returns Object with start and end methods
 */
export function performanceMonitor(label: string) {
  const startTime = performance.now()

  return {
    end: () => {
      const endTime = performance.now()
      const duration = endTime - startTime

      if (duration > 100) {
        console.warn(`Performance warning: ${label} took ${duration.toFixed(2)}ms`)
      }

      return duration
    },
  }
}

/**
 * Cache with TTL (Time To Live)
 * Useful for caching link data with automatic expiration
 */
export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>()
  private ttl: number

  constructor(ttlMs: number = 30000) {
    this.ttl = ttlMs
  }

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl,
    })
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Add missing React import
import * as React from 'react'