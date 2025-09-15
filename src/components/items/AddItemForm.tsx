import { useState } from 'react'
import { useItemsStore } from '../../stores'
import type { ListType } from '../../types'

interface AddItemFormProps {
  listId: string
  listType: ListType
  onItemAdded: () => void
  onCancel: () => void
}

export function AddItemForm({ listId, listType, onItemAdded, onCancel }: AddItemFormProps) {
  const [content, setContent] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')
  
  const { createItem, isLoading } = useItemsStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content.trim()) {
      setError('Item content is required')
      return
    }

    setError('')

    try {
      const newItem = await createItem(listId, {
        content: content.trim(),
        target_date: targetDate || undefined
      })
      
      if (newItem) {
        setContent('')
        setTargetDate('')
        onItemAdded()
      }
    } catch (err) {
      setError('Failed to create item. Please try again.')
    }
  }

  const getPlaceholder = () => {
    switch (listType) {
      case 'grocery':
        return 'Add grocery item (e.g., Milk, Bread, Apples)'
      case 'countdown':
        return 'Add task with deadline (e.g., Submit report)'
      default:
        return 'Add new item'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
          autoFocus
        />
      </div>

      {listType === 'countdown' && (
        <div>
          <label htmlFor="targetDate" className="block text-sm font-medium text-gray-700 mb-1">
            Target Date (optional)
          </label>
          <input
            id="targetDate"
            type="datetime-local"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading || !content.trim()}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Adding...' : 'Add Item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}