import { useState } from 'react'
import { useItemMutations } from '../../hooks'
import type { Item, ListType } from '../../types'
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns'
import { LinkIndicator } from './LinkIndicator'
import { LinkedItemsDisplay } from './LinkedItemsDisplay'
import { ItemLinker } from './ItemLinker'
import { QuickLinkAdd } from './QuickLinkAdd'
import { BulkLinker } from './BulkLinker'
import { LinkSuggestions } from './LinkSuggestions'

interface ItemListProps {
  items: Item[]
  listId: string
  listType: ListType
  enableBulkOperations?: boolean
}

export function ItemList({ items, listId, listType, enableBulkOperations = false }: ItemListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')
  const [showLinksFor, setShowLinksFor] = useState<string | null>(null)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [quickLinkItemId, setQuickLinkItemId] = useState<string | null>(null)
  const [suggestionsItemId, setSuggestionsItemId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showBulkLinker, setShowBulkLinker] = useState(false)

  const { updateItem, deleteItem } = useItemMutations(listId)

  const handleEdit = (item: Item) => {
    setEditingId(item.id)
    setEditContent(item.content)
    setEditTargetDate(item.target_date || '')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return

    try {
      await updateItem.mutateAsync({
        id: id,
        request: {
          content: editContent.trim(),
          target_date: editTargetDate || undefined
        }
      })

      setEditingId(null)
      setEditContent('')
      setEditTargetDate('')
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
    setEditTargetDate('')
  }

  const handleToggleComplete = async (id: string) => {
    const item = items.find(item => item.id === id)
    if (!item) return

    try {
      await updateItem.mutateAsync({
        id: id,
        request: { is_completed: !item.is_completed }
      })
    } catch (error) {
      console.error('Failed to toggle item completion:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem.mutateAsync(id)
      } catch (error) {
        console.error('Failed to delete item:', error)
      }
    }
  }

  const handleToggleLinks = (itemId: string) => {
    setShowLinksFor(showLinksFor === itemId ? null : itemId)
  }

  const handleOpenLinker = (itemId: string) => {
    setLinkingItemId(itemId)
  }

  const handleOpenQuickLink = (itemId: string) => {
    setQuickLinkItemId(itemId)
  }

  const handleLinksUpdated = () => {
    // Trigger re-render of link indicators and displays
    setShowLinksFor(null)
    setLinkingItemId(null)
    setQuickLinkItemId(null)
    setSuggestionsItemId(null)
  }

  const handleOpenSuggestions = (itemId: string) => {
    setSuggestionsItemId(itemId)
  }

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map(item => item.id))
    }
  }

  const handleBulkOperation = () => {
    if (selectedItems.length > 0) {
      setShowBulkLinker(true)
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
      {enableBulkOperations && items.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItems.length === items.length && items.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({selectedItems.length}/{items.length})
                </span>
              </label>
            </div>
            {selectedItems.length > 0 && (
              <button
                onClick={handleBulkOperation}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Bulk Link ({selectedItems.length} items)
              </button>
            )}
          </div>
        </div>
      )}

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
                  disabled={updateItem.isPending || !editContent.trim()}
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
              {enableBulkOperations && (
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => handleItemSelect(item.id)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              )}
              <button
                onClick={() => handleToggleComplete(item.id)}
                disabled={updateItem.isPending}
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
                <div className="flex items-center gap-2">
                  <p className={`text-gray-900 ${
                    item.is_completed ? 'line-through text-gray-500' : ''
                  }`}>
                    {item.content}
                  </p>
                  <LinkIndicator itemId={item.id} />
                </div>

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

                {showLinksFor === item.id && (
                  <LinkedItemsDisplay
                    itemId={item.id}
                    onLinkRemoved={handleLinksUpdated}
                  />
                )}
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggleLinks(item.id)}
                  className={`p-1 hover:text-blue-600 ${
                    showLinksFor === item.id ? 'text-blue-600' : 'text-gray-400'
                  }`}
                  title="View links"
                >
                  🔗
                </button>
                <button
                  onClick={() => handleOpenQuickLink(item.id)}
                  className="p-1 text-gray-400 hover:text-green-600"
                  title="Quick add link"
                >
                  ➕
                </button>
                <button
                  onClick={() => handleOpenLinker(item.id)}
                  className="p-1 text-gray-400 hover:text-purple-600"
                  title="Manage links"
                >
                  ⚙️
                </button>
                <button
                  onClick={() => handleOpenSuggestions(item.id)}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="AI link suggestions"
                >
                  🤖
                </button>
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

      {/* Linking Modals */}
      {linkingItemId && (
        <ItemLinker
          sourceItem={items.find(item => item.id === linkingItemId)!}
          onLinksUpdated={handleLinksUpdated}
          onClose={() => setLinkingItemId(null)}
        />
      )}

      {quickLinkItemId && (
        <QuickLinkAdd
          sourceItemId={quickLinkItemId}
          onLinkAdded={handleLinksUpdated}
          onClose={() => setQuickLinkItemId(null)}
        />
      )}

      {suggestionsItemId && (
        <LinkSuggestions
          sourceItem={items.find(item => item.id === suggestionsItemId)!}
          onSuggestionApplied={handleLinksUpdated}
          onClose={() => setSuggestionsItemId(null)}
        />
      )}

      {showBulkLinker && selectedItems.length > 0 && (
        <BulkLinker
          selectedItems={items.filter(item => selectedItems.includes(item.id))}
          onOperationComplete={() => {
            handleLinksUpdated()
            setSelectedItems([])
            setShowBulkLinker(false)
          }}
          onClose={() => setShowBulkLinker(false)}
        />
      )}
    </div>
  )
}