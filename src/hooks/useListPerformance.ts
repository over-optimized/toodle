import { useMemo } from 'react'
import type { Item } from '../types'

export const useListPerformance = (items: Item[]) => {
  const itemCounts = useMemo(() => {
    const total = items.length
    const completed = items.filter(item => item.is_completed).length
    const pending = total - completed
    const progress = total > 0 ? (completed / total) * 100 : 0

    return {
      total,
      completed,
      pending,
      progress
    }
  }, [items])

  const sortedItems = useMemo(() => {
    return {
      pending: items
        .filter(item => !item.is_completed)
        .sort((a, b) => a.position - b.position),
      completed: items
        .filter(item => item.is_completed)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
  }, [items])

  return {
    itemCounts,
    sortedItems
  }
}

export const useGroceryListPerformance = (items: Item[]) => {
  const GROCERY_CATEGORIES = useMemo(() => [
    { id: 'produce', name: 'Produce', icon: '🥬', color: 'bg-green-100 text-green-800' },
    { id: 'dairy', name: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-800' },
    { id: 'meat', name: 'Meat & Seafood', icon: '🥩', color: 'bg-red-100 text-red-800' },
    { id: 'pantry', name: 'Pantry', icon: '🥫', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'frozen', name: 'Frozen', icon: '🧊', color: 'bg-cyan-100 text-cyan-800' },
    { id: 'bakery', name: 'Bakery', icon: '🍞', color: 'bg-orange-100 text-orange-800' },
    { id: 'household', name: 'Household', icon: '🧽', color: 'bg-purple-100 text-purple-800' },
    { id: 'other', name: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-800' }
  ], [])

  const parseItemContent = useMemo(() => (content: string) => {
    const parts = content.split('|')
    return {
      text: parts[0] || content,
      category: parts[1] || 'other'
    }
  }, [])

  const itemsByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      const { category } = parseItemContent(item.content)
      if (!acc[category]) acc[category] = []
      acc[category].push(item)
      return acc
    }, {} as Record<string, typeof items>)
  }, [items, parseItemContent])

  const pendingCategories = useMemo(() => {
    return GROCERY_CATEGORIES.filter(category =>
      itemsByCategory[category.id]?.some(item => !item.is_completed)
    )
  }, [GROCERY_CATEGORIES, itemsByCategory])

  const completedItems = useMemo(() => {
    return items.filter(item => item.is_completed)
  }, [items])

  const progress = useMemo(() => {
    const totalItems = items.length
    const completedCount = completedItems.length
    return totalItems > 0 ? (completedCount / totalItems) * 100 : 0
  }, [items.length, completedItems.length])

  return {
    GROCERY_CATEGORIES,
    parseItemContent,
    itemsByCategory,
    pendingCategories,
    completedItems,
    progress,
    itemCounts: {
      total: items.length,
      completed: completedItems.length
    }
  }
}

export const useCountdownPerformance = (items: Item[]) => {
  const formatTimeRemaining = useMemo(() => (targetDate: string) => {
    const now = new Date().getTime()
    const target = new Date(targetDate).getTime()
    const difference = target - now

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24))
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((difference % (1000 * 60)) / 1000)

    return { days, hours, minutes, seconds, isExpired: false }
  }, [])

  const getUrgencyColor = useMemo(() => (targetDate: string) => {
    const now = new Date().getTime()
    const target = new Date(targetDate).getTime()
    const hoursRemaining = (target - now) / (1000 * 60 * 60)

    if (hoursRemaining <= 0) return 'text-red-600 bg-red-50 border-red-200' // Expired
    if (hoursRemaining <= 24) return 'text-red-600 bg-red-50 border-red-200' // Critical (< 1 day)
    if (hoursRemaining <= 72) return 'text-orange-600 bg-orange-50 border-orange-200' // Warning (< 3 days)
    if (hoursRemaining <= 168) return 'text-yellow-600 bg-yellow-50 border-yellow-200' // Attention (< 1 week)
    return 'text-green-600 bg-green-50 border-green-200' // Safe
  }, [])

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    })

    return {
      pending: sorted.filter(item => !item.is_completed),
      completed: sorted.filter(item => item.is_completed)
    }
  }, [items])

  const minDateTime = useMemo(() => {
    return new Date(Date.now() + 60000).toISOString().slice(0, 16)
  }, [])

  return {
    formatTimeRemaining,
    getUrgencyColor,
    sortedItems,
    minDateTime
  }
}