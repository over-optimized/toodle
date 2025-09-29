import { useState, memo } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import { useGroceryListPerformance } from '../../hooks/useListPerformance'
import { ValidationService } from '../../services/validation.service'
import { LinkIndicator, LinkedItemsDisplay, ItemLinker, QuickLinkAdd, LinkSuggestions, BulkLinker } from '../items'
import { ActionMenu } from '../ui'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { List } from '../../types'

interface GroceryListProps {
  list: List
}


// Smart categorization based on item content
// Sortable item component
interface SortableGroceryItemProps {
  item: any
  parseItemContent: (content: string) => { text: string; category: string }
  onToggleComplete: (itemId: string, isCompleted: boolean) => void
  onDelete: (itemId: string) => void
  isUpdating: boolean
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

const SortableGroceryItem = memo(({
  item,
  parseItemContent,
  onToggleComplete,
  onDelete,
  isUpdating,
  enableBulkOperations = false,
  selectedItems = [],
  onItemSelect,
  showLinksFor,
  onToggleLinks,
  onOpenLinker,
  onOpenQuickLink,
  onOpenSuggestions,
  onLinksUpdated
}: SortableGroceryItemProps) => {
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

  const { text } = parseItemContent(item.content)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
        </svg>
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
        disabled={isUpdating}
        className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
        aria-label="Mark as complete"
      >
        {item.is_completed && (
          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-900">{text}</span>
          <LinkIndicator itemId={item.id} />
        </div>

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
            onClick={() => onDelete(item.id)}
            disabled={isUpdating}
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
              onClick: () => onDelete(item.id),
              variant: 'destructive' as const,
              disabled: isUpdating
            }
          ]}
        />
      </div>
    </div>
  )
})

SortableGroceryItem.displayName = 'SortableGroceryItem'

// Sortable completed item component
const SortableCompletedItem = memo(({
  item,
  parseItemContent,
  onToggleComplete,
  onDelete,
  isUpdating,
  enableBulkOperations = false,
  selectedItems = [],
  onItemSelect,
  showLinksFor,
  onToggleLinks,
  onOpenLinker,
  onOpenQuickLink,
  onOpenSuggestions,
  onLinksUpdated
}: SortableGroceryItemProps) => {
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

  const { text } = parseItemContent(item.content)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 p-2"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
        </svg>
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
        disabled={isUpdating}
        className="w-5 h-5 bg-green-500 border-2 border-green-500 rounded-full flex items-center justify-center hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
        aria-label="Mark as incomplete"
      >
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 line-through">{text}</span>
          <LinkIndicator itemId={item.id} />
        </div>

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
            onClick={() => onDelete(item.id)}
            disabled={isUpdating}
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
              onClick: () => onDelete(item.id),
              variant: 'destructive' as const,
              disabled: isUpdating
            }
          ]}
        />
      </div>
    </div>
  )
})

SortableCompletedItem.displayName = 'SortableCompletedItem'

const categorizeItem = (content: string): string => {
  const lowercaseContent = content.toLowerCase()

  // Produce
  if (/\b(apple|banana|orange|grape|lettuce|spinach|carrot|tomato|onion|potato|broccoli|cucumber|pepper|avocado|berry|fruit|vegetable)\b/.test(lowercaseContent)) {
    return 'produce'
  }

  // Dairy
  if (/\b(milk|cheese|yogurt|butter|cream|eggs?|dairy)\b/.test(lowercaseContent)) {
    return 'dairy'
  }

  // Meat & Seafood
  if (/\b(chicken|beef|pork|fish|salmon|tuna|shrimp|meat|turkey|ham|bacon)\b/.test(lowercaseContent)) {
    return 'meat'
  }

  // Pantry
  if (/\b(rice|pasta|bread|cereal|oil|vinegar|sauce|spice|flour|sugar|salt|pepper|can|jar)\b/.test(lowercaseContent)) {
    return 'pantry'
  }

  // Frozen
  if (/\b(frozen|ice cream|popsicle|freezer)\b/.test(lowercaseContent)) {
    return 'frozen'
  }

  // Bakery
  if (/\b(bread|bagel|muffin|cake|cookie|pastry|bakery)\b/.test(lowercaseContent)) {
    return 'bakery'
  }

  // Household
  if (/\b(soap|shampoo|toothpaste|detergent|paper|towel|toilet|cleaning|laundry)\b/.test(lowercaseContent)) {
    return 'household'
  }

  return 'other'
}

export const GroceryList = memo(function GroceryList({ list }: GroceryListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

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
  const {
    GROCERY_CATEGORIES,
    parseItemContent,
    itemsByCategory,
    pendingCategories,
    completedItems,
    progress,
    itemCounts
  } = useGroceryListPerformance(items)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) return

    if (active.id !== over.id) {
      const activeIndex = items.findIndex((item) => item.id === active.id)
      const overIndex = items.findIndex((item) => item.id === over.id)

      if (activeIndex !== -1 && overIndex !== -1) {
        const reorderedItems = arrayMove(items, activeIndex, overIndex)
        const reorderedItemIds = reorderedItems.map(item => item.id)

        try {
          await reorderItems.mutateAsync(reorderedItemIds)
        } catch (error) {
          console.error('Failed to reorder items:', error)
        }
      }
    }
  }

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
      const category = selectedCategory || categorizeItem(newItemContent)

      // Store category in item content as metadata (simple approach)
      const itemWithCategory = `${newItemContent.trim()}|${category}`

      await createItem.mutateAsync({
        content: itemWithCategory,
        position
      })
      setNewItemContent('')
      setSelectedCategory('')
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
      {/* Progress bar */}
      {itemCounts.total > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Shopping Progress</span>
            <span className="text-sm text-gray-500">{itemCounts.completed} of {itemCounts.total} items</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Collaboration indicator */}
      {onlineCount > 1 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-800">
            {onlineCount - 1} other shopper{onlineCount - 1 !== 1 ? 's' : ''} updating this list
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

      {/* Shopping list by category */}
      {pendingCategories.map(category => {
        const categoryItems = itemsByCategory[category.id]?.filter(item => !item.is_completed) || []
        if (categoryItems.length === 0) return null

        return (
          <div key={category.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className={`px-4 py-3 ${category.color} border-b border-gray-200`}>
              <h3 className="font-medium flex items-center gap-2">
                <span className="text-lg">{category.icon}</span>
                {category.name}
                <span className="ml-auto bg-white bg-opacity-50 px-2 py-1 rounded-full text-xs">
                  {categoryItems.length}
                </span>
              </h3>
            </div>
            <div className="p-4 space-y-2">
              <SortableContext items={categoryItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                {categoryItems.map(item => (
                  <SortableGroceryItem
                    key={item.id}
                    item={item}
                    parseItemContent={parseItemContent}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteItem}
                    isUpdating={updateItem.isPending || deleteItem.isPending}
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
              </SortableContext>
            </div>
          </div>
        )
      })}

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="font-medium text-gray-700 flex items-center gap-2">
              <span className="text-lg">✅</span>
              Completed
              <span className="ml-auto bg-gray-200 px-2 py-1 rounded-full text-xs">
                {completedItems.length}
              </span>
            </h3>
          </div>
          <div className="p-4 space-y-2">
            <SortableContext items={completedItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {completedItems.map(item => (
                <SortableCompletedItem
                  key={item.id}
                  item={item}
                  parseItemContent={parseItemContent}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                  isUpdating={updateItem.isPending || deleteItem.isPending}
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
            </SortableContext>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400 text-4xl">
            🛒
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Empty grocery list</h3>
          <p className="text-gray-500 mb-4">Add items to your shopping list below.</p>
          <p className="text-sm text-gray-400">
            Items will be automatically organized by grocery store sections.
          </p>
        </div>
      )}

      {/* Add new item form - moved to bottom */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700">Add Grocery Item</span>
          <span className="text-xs text-gray-500">
            {itemCounts.total} of 100 items
          </span>
        </div>
        <form onSubmit={handleAddItem} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              placeholder="Add groceries (e.g., 'Milk', 'Bananas', 'Chicken')..."
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
          </div>

          {/* Category selection (optional override) */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-gray-600 py-2">Category:</span>
            {GROCERY_CATEGORIES.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === category.id ? '' : category.id)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategory === category.id
                    ? `${category.color} border-current`
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
              >
                {category.icon} {category.name}
              </button>
            ))}
          </div>
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