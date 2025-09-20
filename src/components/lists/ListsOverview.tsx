import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores'
import { useLists } from '../../hooks'
import type { ListType } from '../../types'
import { CreateListModal } from './CreateListModal'

export function ListsOverview() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { data: lists = [], isLoading, error } = useLists()
  const { user, signOut } = useAuthStore()

  const getListTypeIcon = (type: ListType) => {
    switch (type) {
      case 'simple':
        return '📝'
      case 'grocery':
        return '🛒'
      case 'countdown':
        return '⏰'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your lists...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Your Lists</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.email}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + New List
            </button>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400"
            >
              Sign Out
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error.message}
          </div>
        )}

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No lists yet
            </h2>
            <p className="text-gray-600 mb-6">
              Create your first list to get started organizing your tasks
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create Your First List
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getListTypeIcon(list.type)}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {list.title}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {list.type} list
                      </p>
                    </div>
                  </div>
                  {list.is_private && (
                    <span className="text-gray-400" title="Private list">
                      🔒
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Updated {formatDate(list.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateListModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}