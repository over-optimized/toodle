import { useState } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import type { List } from '../../types'

interface GroceryListProps {
  list: List
}

const GROCERY_CATEGORIES = [
  { id: 'produce', name: 'Produce', icon: '🥬', color: 'bg-green-100 text-green-800' },
  { id: 'dairy', name: 'Dairy', icon: '🥛', color: 'bg-blue-100 text-blue-800' },
  { id: 'meat', name: 'Meat & Seafood', icon: '🥩', color: 'bg-red-100 text-red-800' },
  { id: 'pantry', name: 'Pantry', icon: '🥫', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'frozen', name: 'Frozen', icon: '🧊', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'bakery', name: 'Bakery', icon: '🍞', color: 'bg-orange-100 text-orange-800' },
  { id: 'household', name: 'Household', icon: '🧽', color: 'bg-purple-100 text-purple-800' },
  { id: 'other', name: 'Other', icon: '📦', color: 'bg-gray-100 text-gray-800' }
]

// Smart categorization based on item content
const categorizeItem = (content: string): string => {
  const lowercaseContent = content.toLowerCase()

  // Produce
  if (/\b(apple|banana|orange|grape|lettuce|spinach|carrot|tomato|onion|potato|broccoli|cucumber|pepper|avocado|berry|fruit|vegetable)\b/.test(lowercaseContent)) {
    return 'produce'
  }

  // Dairy
  if (/\b(milk|cheese|yogurt|butter|cream|eggs?|dairy)\b/.test(lowercaseContent)) {
    return 'dairy'
  }

  // Meat & Seafood
  if (/\b(chicken|beef|pork|fish|salmon|tuna|shrimp|meat|turkey|ham|bacon)\b/.test(lowercaseContent)) {
    return 'meat'
  }

  // Pantry
  if (/\b(rice|pasta|bread|cereal|oil|vinegar|sauce|spice|flour|sugar|salt|pepper|can|jar)\b/.test(lowercaseContent)) {
    return 'pantry'
  }

  // Frozen
  if (/\b(frozen|ice cream|popsicle|freezer)\b/.test(lowercaseContent)) {
    return 'frozen'
  }

  // Bakery
  if (/\b(bread|bagel|muffin|cake|cookie|pastry|bakery)\b/.test(lowercaseContent)) {
    return 'bakery'
  }

  // Household
  if (/\b(soap|shampoo|toothpaste|detergent|paper|towel|toilet|cleaning|laundry)\b/.test(lowercaseContent)) {
    return 'household'
  }

  return 'other'
}

export function GroceryList({ list }: GroceryListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: items = [], isLoading, error } = useItems(list.id)
  const { createItem, updateItem, deleteItem } = useItemMutations()
  const { otherUsers, onlineCount } = usePresence(list.id)

  // Enable real-time updates
  useRealtimeList(list.id)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemContent.trim()) return

    try {
      const position = Math.max(...items.map(item => item.position), 0) + 1
      const category = selectedCategory || categorizeItem(newItemContent)

      // Store category in item content as metadata (simple approach)
      const itemWithCategory = `${newItemContent.trim()}|${category}`

      await createItem.mutateAsync({
        listId: list.id,
        item: {
          content: itemWithCategory,
          position
        }
      })
      setNewItemContent('')
      setSelectedCategory('')
    } catch (error) {
      console.error('Failed to add item:', error)
    }
  }

  const handleToggleComplete = async (itemId: string, isCompleted: boolean) => {
    try {
      await updateItem.mutateAsync({
        id: itemId,
        updates: { is_completed: !isCompleted }
      })
    } catch (error) {
      console.error('Failed to toggle item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await deleteItem.mutateAsync(itemId)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const parseItemContent = (content: string) => {
    const parts = content.split('|')
    return {
      text: parts[0] || content,
      category: parts[1] || 'other'
    }
  }

  const itemsByCategory = items.reduce((acc, item) => {
    const { category } = parseItemContent(item.content)
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, typeof items>)

  const pendingCategories = GROCERY_CATEGORIES.filter(category =>
    itemsByCategory[category.id]?.some(item => !item.is_completed)
  )

  const completedItems = items.filter(item => item.is_completed)
  const totalItems = items.length
  const completedCount = completedItems.length
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded-lg">
        Failed to load items: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {totalItems > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Shopping Progress</span>
            <span className="text-sm text-gray-500">{completedCount} of {totalItems} items</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Collaboration indicator */}
      {onlineCount > 1 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-800">
            {onlineCount - 1} other shopper{onlineCount - 1 !== 1 ? 's' : ''} updating this list
          </span>
          {otherUsers.length > 0 && (
            <div className="flex -space-x-2 ml-2">
              {otherUsers.slice(0, 3).map(user => (
                <div
                  key={user.user_id}
                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.display_name || user.email}
                >
                  {(user.display_name || user.email)[0].toUpperCase()}
                </div>
              ))}
              {otherUsers.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-xs font-medium text-white">
                  +{otherUsers.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add new item form */}
      <form onSubmit={handleAddItem} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="Add groceries (e.g., 'Milk', 'Bananas', 'Chicken')..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={createItem.isPending}
          />
          <button
            type="submit"
            disabled={createItem.isPending || !newItemContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createItem.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>

        {/* Category selection (optional override) */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-600 py-2">Category:</span>
          {GROCERY_CATEGORIES.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                selectedCategory === category.id
                  ? `${category.color} border-current`
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
            >
              {category.icon} {category.name}
            </button>
          ))}
        </div>
      </form>

      {/* Shopping list by category */}
      {pendingCategories.map(category => {
        const categoryItems = itemsByCategory[category.id]?.filter(item => !item.is_completed) || []
        if (categoryItems.length === 0) return null

        return (
          <div key={category.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className={`px-4 py-3 ${category.color} border-b border-gray-200`}>
              <h3 className="font-medium flex items-center gap-2">
                <span className="text-lg">{category.icon}</span>
                {category.name}
                <span className="ml-auto bg-white bg-opacity-50 px-2 py-1 rounded-full text-xs">
                  {categoryItems.length}
                </span>
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {categoryItems.map(item => {
                const { text } = parseItemContent(item.content)
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <button
                      onClick={() => handleToggleComplete(item.id, item.is_completed)}
                      disabled={updateItem.isPending}
                      className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                      aria-label="Mark as complete"
                    />

                    <span className="flex-1 text-gray-900">{text}</span>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deleteItem.isPending}
                      className="text-red-600 hover:text-red-800 focus:outline-none disabled:opacity-50"
                      aria-label="Delete item"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              <span className="text-lg">✅</span>
              Completed
              <span className="ml-auto bg-gray-200 px-2 py-1 rounded-full text-xs">
                {completedItems.length}
              </span>
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {completedItems.map(item => {
              const { text } = parseItemContent(item.content)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2"
                >
                  <button
                    onClick={() => handleToggleComplete(item.id, item.is_completed)}
                    disabled={updateItem.isPending}
                    className="w-5 h-5 bg-green-500 border-2 border-green-500 rounded-full flex items-center justify-center hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    aria-label="Mark as incomplete"
                  >
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>

                  <span className="flex-1 text-gray-600 line-through">{text}</span>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={deleteItem.isPending}
                    className="text-red-600 hover:text-red-800 focus:outline-none disabled:opacity-50"
                    aria-label="Delete item"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400 text-4xl">
            🛒
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Empty grocery list</h3>
          <p className="text-gray-500 mb-4">Add items to your shopping list to get started.</p>
          <p className="text-sm text-gray-400">
            Items will be automatically organized by grocery store sections.
          </p>
        </div>
      )}
    </div>
  )
}