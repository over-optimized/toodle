import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListsStore } from '../../stores'
import type { ListType } from '../../types'

interface CreateListModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateListModal({ isOpen, onClose }: CreateListModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ListType>('simple')
  const [isPrivate, setIsPrivate] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { createList } = useListsStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const newList = await createList({
        title: title.trim(),
        type,
        is_private: isPrivate
      })
      
      if (newList) {
        onClose()
        navigate(`/lists/${newList.id}`)
      }
    } catch (err) {
      setError('Failed to create list. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const listTypes: { value: ListType; label: string; description: string; icon: string }[] = [
    {
      value: 'simple',
      label: 'Simple List',
      description: 'Basic todo list for general tasks',
      icon: '📝'
    },
    {
      value: 'grocery',
      label: 'Grocery List',
      description: 'Shopping list with completion tracking',
      icon: '🛒'
    },
    {
      value: 'countdown',
      label: 'Countdown List',
      description: 'Tasks with deadlines and time tracking',
      icon: '⏰'
    }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Create New List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              List Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter list title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              List Type
            </label>
            <div className="space-y-2">
              {listTypes.map((listType) => (
                <label
                  key={listType.value}
                  className="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300"
                >
                  <input
                    type="radio"
                    name="type"
                    value={listType.value}
                    checked={type === listType.value}
                    onChange={(e) => setType(e.target.value as ListType)}
                    className="mt-1 mr-3"
                    disabled={isLoading}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{listType.icon}</span>
                      <span className="font-medium text-gray-900">{listType.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{listType.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mr-2"
                disabled={isLoading}
              />
              <span className="text-sm text-gray-700">
                Make this list private (only you can see it)
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}