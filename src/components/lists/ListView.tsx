import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useListsStore, useItemsStore } from '../../stores'
import { ItemList } from '../items/ItemList'
import { AddItemForm } from '../items/AddItemForm'
import { ShareModal } from '../sharing/ShareModal'

export function ListView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showAddItem, setShowAddItem] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  
  const { currentList, isLoading, error, fetchList, deleteList } = useListsStore()
  const { createItem: _ } = useItemsStore()

  useEffect(() => {
    if (id) {
      fetchList(id)
    }
  }, [id, fetchList])

  const handleDeleteList = async () => {
    if (!currentList || !window.confirm('Are you sure you want to delete this list?')) {
      return
    }
    
    await deleteList(currentList.id)
    navigate('/')
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading list...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error loading list</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Lists
          </Link>
        </div>
      </div>
    )
  }

  if (!currentList) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">List not found</h2>
          <p className="text-gray-600 mb-6">The list you're looking for doesn't exist.</p>
          <Link
            to="/"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Back to Lists
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
            >
              ← Back to Lists
            </Link>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddItem(!showAddItem)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + Add Item
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Share
            </button>
            <button
              onClick={handleDeleteList}
              className="text-red-600 hover:text-red-800 px-4 py-2 rounded-lg border border-red-300 hover:border-red-400"
            >
              Delete List
            </button>
          </div>
        </header>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{getListTypeIcon(currentList.type)}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{currentList.title}</h1>
                <p className="text-gray-600 capitalize">{currentList.type} list</p>
              </div>
            </div>
            
            {currentList.is_private && (
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                <span>🔒</span>
                <span>Private list</span>
              </div>
            )}
          </div>

          {showAddItem && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <AddItemForm
                listId={currentList.id}
                listType={currentList.type}
                onItemAdded={() => setShowAddItem(false)}
                onCancel={() => setShowAddItem(false)}
              />
            </div>
          )}

          <div className="p-6">
            {currentList.items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No items yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Add your first item to get started
                </p>
                <button
                  onClick={() => setShowAddItem(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add First Item
                </button>
              </div>
            ) : (
              <ItemList items={currentList.items} listType={currentList.type} />
            )}
          </div>
        </div>

        {showShareModal && currentList && (
          <ShareModal
            listId={currentList.id}
            listTitle={currentList.title}
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
          />
        )}
      </div>
    </div>
  )
}