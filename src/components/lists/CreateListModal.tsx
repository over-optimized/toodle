import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListMutations } from '../../hooks'
import type { ListType } from '../../types'

interface CreateListModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateListModal({ isOpen, onClose }: CreateListModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ListType>('simple')
  const [isPrivate, setIsPrivate] = useState(true)
  const [error, setError] = useState('')

  const { createList } = useListMutations()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setError('')

    try {
      const result = await createList.mutateAsync({
        title: title.trim(),
        type,
        is_private: isPrivate
      })

      if (result.data) {
        onClose()
        navigate(`/lists/${result.data.id}`)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to create list. Please try again.')
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-lg sm:rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Create New List</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 -m-2"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              List Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter list title"
              className="w-full px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={createList.isPending}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              List Type
            </label>
            <div className="space-y-2 sm:space-y-3">
              {listTypes.map((listType) => (
                <label
                  key={listType.value}
                  className="flex items-start p-3 sm:p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 active:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="type"
                    value={listType.value}
                    checked={type === listType.value}
                    onChange={(e) => setType(e.target.value as ListType)}
                    className="mt-1 mr-3 w-4 h-4"
                    disabled={createList.isPending}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg sm:text-xl">{listType.icon}</span>
                      <span className="font-medium text-gray-900 text-sm sm:text-base">{listType.label}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">{listType.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="py-2">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-1 w-4 h-4"
                disabled={createList.isPending}
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                Make this list private (only you can see it)
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6">
            <button
              type="button"
              onClick={onClose}
              className="order-2 sm:order-1 flex-1 py-3 sm:py-2 px-4 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm sm:text-base font-medium"
              disabled={createList.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="order-1 sm:order-2 flex-1 py-3 sm:py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
              disabled={createList.isPending}
            >
              {createList.isPending ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}