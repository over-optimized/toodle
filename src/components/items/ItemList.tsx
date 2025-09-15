import { useState } from 'react'
import { useItemsStore } from '../../stores'
import type { Item, ListType } from '../../types'
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns'

interface ItemListProps {
  items: Item[]
  listType: ListType
}

export function ItemList({ items, listType }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')
  
  const { toggleItemCompletion, updateItem, deleteItem, isLoading } = useItemsStore()

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditContent(item.content)
    setEditTargetDate(item.target_date || '')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return
    
    await updateItem(id, {
      content: editContent.trim(),
      target_date: editTargetDate || undefined
    })
    
    setEditingId(null)
    setEditContent('')
    setEditTargetDate('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditTargetDate('')
  }

  const handleToggleComplete = async (id: string) => {
    await toggleItemCompletion(id)
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteItem(id)
    }
  }

  const isOverdue = (targetDate: string) => {
    return isAfter(new Date(), parseISO(targetDate))
  }

  const formatTargetDate = (targetDate: string) => {
    const date = parseISO(targetDate)
    const now = new Date()
    
    if (isAfter(now, date)) {
      return `Overdue by ${formatDistanceToNow(date)}`
    } else {
      return `Due in ${formatDistanceToNow(date)}`
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_completed === b.is_completed) {
      return a.position - b.position
    }
    return a.is_completed ? 1 : -1
  })

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => (
        <div
          key={item.id}
          className={`group border border-gray-200 rounded-lg p-4 transition-all ${
            item.is_completed ? 'bg-gray-50 opacity-60' : 'bg-white hover:shadow-sm'
          }`}
        >
          {editingId === item.id ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              
              {listType === 'countdown' && (
                <input
                  type="datetime-local"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(item.id)}
                  disabled={isLoading || !editContent.trim()}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <button
                onClick={() => handleToggleComplete(item.id)}
                disabled={isLoading}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.is_completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-green-400'
                }`}
              >
                {item.is_completed && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <p className={`text-gray-900 ${
                  item.is_completed ? 'line-through text-gray-500' : ''
                }`}>
                  {item.content}
                </p>
                
                {item.target_date && (
                  <p className={`text-sm mt-1 ${
                    isOverdue(item.target_date) && !item.is_completed
                      ? 'text-red-600 font-medium'
                      : 'text-gray-500'
                  }`}>
                    {formatTargetDate(item.target_date)}
                  </p>
                )}
                
                {item.completed_at && (
                  <p className="text-sm text-gray-500 mt-1">
                    Completed {formatDistanceToNow(parseISO(item.completed_at))} ago
                  </p>
                )}
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Edit item"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete item"
                >
                  🗑️
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}