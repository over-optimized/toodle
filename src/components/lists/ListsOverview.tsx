import { useState, memo, Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores'
import { useLists } from '../../hooks'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { ListType } from '../../types'

// Lazy load the CreateListModal since it's only used when creating lists
const CreateListModal = lazy(() => import('./CreateListModal').then(module => ({ default: module.CreateListModal })))

export const ListsOverview = memo(function ListsOverview() {
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Lists</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base truncate">
                Welcome back, {user?.email}
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex-1 sm:flex-none bg-blue-600 text-white px-4 sm:px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm sm:text-base font-medium"
              >
                <span className="sm:hidden">+ New List</span>
                <span className="hidden sm:inline">+ New List</span>
              </button>
              <button
                onClick={signOut}
                className="flex-1 sm:flex-none text-gray-600 hover:text-gray-800 px-4 sm:px-4 py-2.5 sm:py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm sm:text-base"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error.message}
          </div>
        )}

        {lists.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="text-4xl sm:text-6xl mb-4">📝</div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              No lists yet
            </h2>
            <p className="text-gray-600 mb-6 text-sm sm:text-base max-w-md mx-auto">
              Create your first list to get started organizing your tasks
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Create Your First List
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all active:scale-95 sm:active:scale-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{getListTypeIcon(list.type)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                        {list.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 capitalize">
                        {list.type} list
                      </p>
                    </div>
                  </div>
                  {list.is_private && (
                    <span className="text-gray-400 text-sm sm:text-base flex-shrink-0 ml-2" title="Private list">
                      🔒
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-gray-500">
                  Updated {formatDate(list.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <Suspense fallback={<LoadingSpinner size="sm" text="Loading create form..." />}>
          <CreateListModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
          />
        </Suspense>
      )}
    </div>
  )
})