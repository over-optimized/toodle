import { useState } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import type { List } from '../../types'

interface SimpleListProps {
  list: List
}

export function SimpleList({ list }: SimpleListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { data: items = [], isLoading, error } = useItems(list.id)
  const { createItem, updateItem, deleteItem } = useItemMutations(list.id)
  const { otherUsers, onlineCount } = usePresence(list.id)

  // Enable real-time updates
  useRealtimeList(list.id)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemContent.trim()) return

    try {
      const position = Math.max(...items.map(item => item.position), 0) + 1
      await createItem.mutateAsync({
        content: newItemContent.trim(),
        position
      })
      setNewItemContent('')
    } catch (error) {
      console.error('Failed to add item:', error)
    }
  }

  const handleToggleComplete = async (itemId: string, isCompleted: boolean) => {
    try {
      await updateItem.mutateAsync({
        id: itemId,
        request: { is_completed: !isCompleted }
      })
    } catch (error) {
      console.error('Failed to toggle item:', error)
    }
  }

  const handleStartEdit = (itemId: string, content: string) => {
    setEditingId(itemId)
    setEditContent(content)
  }

  const handleSaveEdit = async (itemId: string) => {
    if (!editContent.trim()) return

    try {
      await updateItem.mutateAsync({
        id: itemId,
        request: { content: editContent.trim() }
      })
      setEditingId(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await deleteItem.mutateAsync(itemId)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const pendingItems = items.filter(item => !item.is_completed)
  const completedItems = items.filter(item => item.is_completed)

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
      {/* Collaboration indicator */}
      {onlineCount > 1 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-800">
            {onlineCount - 1} other user{onlineCount - 1 !== 1 ? 's' : ''} viewing this list
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


      {/* Pending items */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            To Do ({pendingItems.length})
          </h3>
          <div className="space-y-2">
            {pendingItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
              >
                <button
                  onClick={() => handleToggleComplete(item.id, item.is_completed)}
                  disabled={updateItem.isPending}
                  className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
                  aria-label="Mark as complete"
                >
                  {item.is_completed && (
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {editingId === item.id ? (
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span
                      className="flex-1 text-gray-900 cursor-pointer"
                      onClick={() => handleStartEdit(item.id, item.content)}
                    >
                      {item.content}
                    </span>
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-600">
            Completed ({completedItems.length})
          </h3>
          <div className="space-y-2">
            {completedItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
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

                <span className="flex-1 text-gray-600 line-through">
                  {item.content}
                </span>

                <span className="text-xs text-gray-500">
                  {item.completed_at && new Date(item.completed_at).toLocaleDateString()}
                </span>

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
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
          <p className="text-gray-500">Start by adding your first item below.</p>
        </div>
      )}

      {/* Add new item form - moved to bottom */}
      <div className="pt-4 border-t border-gray-200">
        <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="Add a new item..."
            className="flex-1 px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={createItem.isPending}
          />
          <button
            type="submit"
            disabled={createItem.isPending || !newItemContent.trim()}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-sm"
          >
            {createItem.isPending ? 'Adding...' : 'Add Item'}
          </button>
        </form>
      </div>
    </div>
  )
}