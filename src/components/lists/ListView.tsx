import { useParams, Link, useNavigate } from 'react-router-dom'
import { useList, useListMutations } from '../../hooks'
import { useRealtimeListsOverview } from '../../hooks/useRealtimeList'
import { SimpleList } from './SimpleList'
import { GroceryList } from './GroceryList'
import { CountdownList } from './CountdownList'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { useState, memo, Suspense, lazy } from 'react'

// Lazy load the ShareModal since it's only used when sharing
const ShareModal = lazy(() => import('../sharing/ShareModal').then(module => ({ default: module.ShareModal })))

export const ListView = memo(function ListView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: list, isLoading, error } = useList(id!)
  const { deleteList } = useListMutations()

  // Enable real-time updates for lists overview
  useRealtimeListsOverview()

  const handleDeleteList = async () => {
    if (!list) return

    try {
      await deleteList.mutateAsync(list.id)
      navigate('/')
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  const getListTypeIcon = (type: string) => {
    switch (type) {
      case 'simple':
        return '📝'
      case 'grocery':
        return '🛒'
      case 'countdown':
        return '⏰'
      default:
        return '📝'
    }
  }

  const renderListComponent = () => {
    if (!list) return null

    switch (list.type) {
      case 'grocery':
        return <GroceryList list={list} />
      case 'countdown':
        return <CountdownList list={list} />
      case 'simple':
      default:
        return <SimpleList list={list} />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">Loading list...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="text-4xl sm:text-6xl mb-4">⚠️</div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Error loading list</h2>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">{error.message}</p>
          <Link
            to="/"
            className="inline-block w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Back to Lists
          </Link>
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="text-4xl sm:text-6xl mb-4">📝</div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">List not found</h2>
          <p className="text-gray-600 mb-6 text-sm sm:text-base">The list you're looking for doesn't exist.</p>
          <Link
            to="/"
            className="inline-block w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Back to Lists
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Mobile-optimized header */}
        <header className="mb-6">
          {/* Mobile navigation */}
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-800 text-sm sm:text-base flex items-center gap-1 py-2 pr-2 -ml-2"
            >
              ← Back to Lists
            </Link>

            {/* Mobile menu button - shows actions in a dropdown */}
            <div className="sm:hidden">
              <button
                className="p-2 text-gray-600"
                onClick={() => setShowDeleteConfirm(true)}
              >
                ⋮
              </button>
            </div>
          </div>

          {/* List title section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-2xl sm:text-3xl flex-shrink-0">{getListTypeIcon(list.type)}</span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{list.title}</h1>
                  <p className="text-gray-600 capitalize text-sm sm:text-base">{list.type} list</p>
                  {list.is_private && (
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 mt-1">
                      <span>🔒</span>
                      <span>Private list</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop action buttons */}
            <div className="hidden sm:flex gap-3 mt-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium"
              >
                Share
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-800 px-4 py-2 rounded-lg border border-red-300 hover:border-red-400 text-sm font-medium"
              >
                Delete List
              </button>
            </div>

            {/* Mobile action buttons - only Share and Delete */}
            <div className="flex sm:hidden gap-2 mt-4">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 text-sm font-medium"
              >
                Share
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 text-red-600 hover:text-red-800 py-3 rounded-lg border border-red-300 hover:border-red-400 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </header>

        {/* List content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          {renderListComponent()}
        </div>

        {/* Share Modal */}
        {showShareModal && (
          <Suspense fallback={<LoadingSpinner size="sm" text="Loading share options..." />}>
            <ShareModal
              listId={list.id}
              listTitle={list.title}
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
            />
          </Suspense>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <div className="bg-white rounded-t-lg sm:rounded-lg max-w-md w-full p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete List</h3>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to delete "{list.title}"? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 sm:py-2 px-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-medium"
                  disabled={deleteList.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteList}
                  className="flex-1 py-2.5 sm:py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  disabled={deleteList.isPending}
                >
                  {deleteList.isPending ? 'Deleting...' : 'Delete List'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})