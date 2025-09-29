import { useState, memo } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import { useListPerformance } from '../../hooks/useListPerformance'
import { ValidationService } from '../../services/validation.service'
import { LinkIndicator, LinkedItemsDisplay, ItemLinker, QuickLinkAdd, LinkSuggestions, BulkLinker } from '../items'
import { ActionMenu } from '../ui'
import type { List, Item } from '../../types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SimpleListProps {
  list: List
}

interface SortableSimpleItemProps {
  item: Item
  editingId: string | null
  editContent: string
  onToggleComplete: (itemId: string, isCompleted: boolean) => void
  onStartEdit: (itemId: string, content: string) => void
  onSaveEdit: (itemId: string) => void
  onCancelEdit: () => void
  onDeleteItem: (itemId: string) => void
  setEditContent: (content: string) => void
  updateItem: any
  deleteItem: any
  isCompleted?: boolean
  enableBulkOperations?: boolean
  selectedItems?: string[]
  onItemSelect?: (itemId: string) => void
  showLinksFor?: string | null
  onToggleLinks?: (itemId: string) => void
  onOpenLinker?: (itemId: string) => void
  onOpenQuickLink?: (itemId: string) => void
  onOpenSuggestions?: (itemId: string) => void
  onLinksUpdated?: () => void
}

function SortableSimpleItem({
  item,
  editingId,
  editContent,
  onToggleComplete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteItem,
  setEditContent,
  updateItem,
  deleteItem,
  isCompleted = false,
  enableBulkOperations = false,
  selectedItems = [],
  onItemSelect,
  showLinksFor,
  onToggleLinks,
  onOpenLinker,
  onOpenQuickLink,
  onOpenSuggestions,
  onLinksUpdated
}: SortableSimpleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow ${
        isCompleted ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
        title="Drag to reorder"
      >
        ⋮⋮
      </div>

      {enableBulkOperations && (
        <input
          type="checkbox"
          checked={selectedItems.includes(item.id)}
          onChange={() => onItemSelect?.(item.id)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )}

      <button
        onClick={() => onToggleComplete(item.id, item.is_completed)}
        disabled={updateItem.isPending}
        className={`w-5 h-5 border-2 rounded-full hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center ${
          isCompleted
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300'
        }`}
        aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
      >
        {item.is_completed && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
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
              if (e.key === 'Enter') onSaveEdit(item.id)
              if (e.key === 'Escape') onCancelEdit()
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(item.id)}
              className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`cursor-pointer ${
                  isCompleted ? 'text-gray-600 line-through' : 'text-gray-900'
                }`}
                onClick={() => onStartEdit(item.id, item.content)}
              >
                {item.content}
              </span>
              <LinkIndicator itemId={item.id} />
            </div>

            {isCompleted && (
              <span className="text-xs text-gray-500">
                {item.completed_at && new Date(item.completed_at).toLocaleDateString()}
              </span>
            )}

            {showLinksFor === item.id && (
              <LinkedItemsDisplay
                itemId={item.id}
                onLinkRemoved={onLinksUpdated}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Link indicator that doubles as view links button on mobile */}
            <LinkIndicator
              itemId={item.id}
              showDetails={false}
              className="sm:hidden cursor-pointer"
              onClick={() => onToggleLinks?.(item.id)}
            />

            {/* Desktop: Individual buttons with hover visibility */}
            <div className="hidden sm:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onToggleLinks?.(item.id)}
                className={`p-1 hover:text-blue-600 ${
                  showLinksFor === item.id ? 'text-blue-600' : 'text-gray-400'
                }`}
                title="View links"
              >
                🔗
              </button>
              <button
                onClick={() => onOpenQuickLink?.(item.id)}
                className="p-1 text-gray-400 hover:text-green-600"
                title="Quick add link"
              >
                ➕
              </button>
              <button
                onClick={() => onOpenLinker?.(item.id)}
                className="p-1 text-gray-400 hover:text-purple-600"
                title="Manage links"
              >
                ⚙️
              </button>
              <button
                onClick={() => onOpenSuggestions?.(item.id)}
                className="p-1 text-gray-400 hover:text-yellow-600"
                title="AI link suggestions"
              >
                🤖
              </button>
              <button
                onClick={() => onDeleteItem(item.id)}
                disabled={deleteItem.isPending}
                className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                title="Delete item"
              >
                🗑️
              </button>
            </div>

            {/* Mobile: Action menu */}
            <ActionMenu
              className="sm:hidden"
              items={[
                {
                  id: 'quick-link',
                  label: 'Quick add link',
                  icon: '➕',
                  onClick: () => onOpenQuickLink?.(item.id)
                },
                {
                  id: 'manage-links',
                  label: 'Manage links',
                  icon: '⚙️',
                  onClick: () => onOpenLinker?.(item.id)
                },
                {
                  id: 'ai-suggestions',
                  label: 'AI suggestions',
                  icon: '🤖',
                  onClick: () => onOpenSuggestions?.(item.id)
                },
                {
                  id: 'delete',
                  label: 'Delete item',
                  icon: '🗑️',
                  onClick: () => onDeleteItem(item.id),
                  variant: 'destructive' as const,
                  disabled: deleteItem.isPending
                }
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}

export const SimpleList = memo(function SimpleList({ list }: SimpleListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // Linking state management
  const [showLinksFor, setShowLinksFor] = useState<string | null>(null)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null)
  const [quickLinkItemId, setQuickLinkItemId] = useState<string | null>(null)
  const [suggestionsItemId, setSuggestionsItemId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [showBulkLinker, setShowBulkLinker] = useState(false)
  const [enableBulkOperations, setEnableBulkOperations] = useState(false)

  const { data: items = [], isLoading, error } = useItems(list.id)
  const { createItem, updateItem, deleteItem, reorderItems } = useItemMutations(list.id)
  const { otherUsers, onlineCount } = usePresence(list.id)

  // Enable real-time updates
  useRealtimeList(list.id)

  // Performance optimizations
  const { sortedItems } = useListPerformance(items)

  // Get usage stats for validation
  const usageStats = ValidationService.getUsageStats([], items)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemContent.trim()) return

    // Validate item content
    const contentValidation = ValidationService.validateItemContent(newItemContent)
    if (!contentValidation.isValid) {
      alert(ValidationService.getErrorMessage(contentValidation.errors))
      return
    }

    // Validate item count limit
    const itemLimitValidation = ValidationService.validateItemCreation(items)
    if (!itemLimitValidation.isValid) {
      alert(ValidationService.getErrorMessage(itemLimitValidation.errors))
      return
    }

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

  // Linking handlers
  const handleToggleLinks = (itemId: string) => {
    setShowLinksFor(showLinksFor === itemId ? null : itemId)
  }

  const handleOpenLinker = (itemId: string) => {
    setLinkingItemId(itemId)
  }

  const handleOpenQuickLink = (itemId: string) => {
    setQuickLinkItemId(itemId)
  }

  const handleOpenSuggestions = (itemId: string) => {
    setSuggestionsItemId(itemId)
  }

  const handleLinksUpdated = () => {
    setShowLinksFor(null)
    setLinkingItemId(null)
    setQuickLinkItemId(null)
    setSuggestionsItemId(null)
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

  const pendingItems = sortedItems.pending
  const completedItems = sortedItems.completed

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine which section the items are in
    const activeItem = items.find(item => item.id === activeId)
    const overItem = items.find(item => item.id === overId)

    if (!activeItem || !overItem) return

    // Only allow reordering within the same completion status
    if (activeItem.is_completed !== overItem.is_completed) return

    const relevantItems = activeItem.is_completed ? completedItems : pendingItems
    const oldIndex = relevantItems.findIndex(item => item.id === activeId)
    const newIndex = relevantItems.findIndex(item => item.id === overId)

    if (oldIndex === -1 || newIndex === -1) return

    const reorderedItems = arrayMove(relevantItems, oldIndex, newIndex)
    const reorderedIds = reorderedItems.map(item => item.id)

    try {
      await reorderItems.mutateAsync(reorderedIds)
    } catch (error) {
      console.error('Failed to reorder items:', error)
    }
  }

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
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

      {/* Bulk operations */}
      {items.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableBulkOperations}
                  onChange={(e) => {
                    setEnableBulkOperations(e.target.checked)
                    if (!e.target.checked) {
                      setSelectedItems([])
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Enable Bulk Operations
                </span>
              </label>
              {enableBulkOperations && (
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
              )}
            </div>
            {enableBulkOperations && selectedItems.length > 0 && (
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

      {/* Pending items */}
      {pendingItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">
            To Do ({pendingItems.length})
          </h3>
          <SortableContext items={pendingItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {pendingItems.map(item => (
                <SortableSimpleItem
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editContent={editContent}
                  onToggleComplete={handleToggleComplete}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDeleteItem={handleDeleteItem}
                  setEditContent={setEditContent}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  isCompleted={false}
                  enableBulkOperations={enableBulkOperations}
                  selectedItems={selectedItems}
                  onItemSelect={handleItemSelect}
                  showLinksFor={showLinksFor}
                  onToggleLinks={handleToggleLinks}
                  onOpenLinker={handleOpenLinker}
                  onOpenQuickLink={handleOpenQuickLink}
                  onOpenSuggestions={handleOpenSuggestions}
                  onLinksUpdated={handleLinksUpdated}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-600">
            Completed ({completedItems.length})
          </h3>
          <SortableContext items={completedItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {completedItems.map(item => (
                <SortableSimpleItem
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editContent={editContent}
                  onToggleComplete={handleToggleComplete}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDeleteItem={handleDeleteItem}
                  setEditContent={setEditContent}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  isCompleted={true}
                  enableBulkOperations={enableBulkOperations}
                  selectedItems={selectedItems}
                  onItemSelect={handleItemSelect}
                  showLinksFor={showLinksFor}
                  onToggleLinks={handleToggleLinks}
                  onOpenLinker={handleOpenLinker}
                  onOpenQuickLink={handleOpenQuickLink}
                  onOpenSuggestions={handleOpenSuggestions}
                  onLinksUpdated={handleLinksUpdated}
                />
              ))}
            </div>
          </SortableContext>
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
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700">Add New Item</span>
          <span className="text-xs text-gray-500">
            {usageStats.items?.current || 0} of {usageStats.items?.max || 100} items
          </span>
        </div>
        <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="Add a new item..."
            className="flex-1 px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={createItem.isPending}
            maxLength={500}
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
    </DndContext>
  )
})