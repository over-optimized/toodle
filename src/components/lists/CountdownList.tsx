import { useState, memo } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import { useCountdownPerformance } from '../../hooks/useListPerformance'
import { ValidationService } from '../../services/validation.service'
import type { List } from '../../types'
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
  verticalListSortingStrategy
} from '@dnd-kit/sortable'

interface CountdownListProps {
  list: List
}




export const CountdownList = memo(function CountdownList({ list }: CountdownListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [newItemTargetDate, setNewItemTargetDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')

  const { data: items = [], isLoading, error } = useItems(list.id)
  const { createItem, updateItem, deleteItem, reorderItems } = useItemMutations(list.id)
  const { otherUsers, onlineCount } = usePresence(list.id)

  // Enable real-time updates
  useRealtimeList(list.id)

  // Performance optimizations
  const {
    formatTimeRemaining,
    getUrgencyColor,
    sortedItems,
    minDateTime
  } = useCountdownPerformance(items)


  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemContent.trim() || !newItemTargetDate) return

    // Validate item content
    const contentValidation = ValidationService.validateItemContent(newItemContent)
    if (!contentValidation.isValid) {
      alert(ValidationService.getErrorMessage(contentValidation.errors))
      return
    }

    // Validate target date
    const dateValidation = ValidationService.validateTargetDate(newItemTargetDate)
    if (!dateValidation.isValid) {
      alert(ValidationService.getErrorMessage(dateValidation.errors))
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
      const targetDate = new Date(newItemTargetDate)

      await createItem.mutateAsync({
        content: newItemContent.trim(),
        position,
        target_date: targetDate.toISOString()
      })
      setNewItemContent('')
      setNewItemTargetDate('')
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

  const handleStartEdit = (itemId: string, content: string, targetDate?: string) => {
    setEditingId(itemId)
    setEditContent(content)
    setEditTargetDate(targetDate ? new Date(targetDate).toISOString().slice(0, 16) : '')
  }

  const handleSaveEdit = async (itemId: string) => {
    if (!editContent.trim()) return

    let updates: any = { content: editContent.trim() }

    if (editTargetDate) {
      const targetDate = new Date(editTargetDate)
      if (targetDate <= new Date()) {
        alert('Target date must be in the future')
        return
      }
      updates.target_date = targetDate.toISOString()
    }

    try {
      await updateItem.mutateAsync({
        id: itemId,
        request: updates
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

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      await deleteItem.mutateAsync(itemId)
    } catch (error) {
      console.error('Failed to delete item:', error)
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
            {onlineCount - 1} other user{onlineCount - 1 !== 1 ? 's' : ''} tracking deadlines with you
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


      {/* Pending items with countdowns */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">
            Active Deadlines ({pendingItems.length})
          </h3>
          <SortableContext items={pendingItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {pendingItems.map(item => {
              if (!item.target_date) return null

              const timeRemaining = formatTimeRemaining(item.target_date)
              const urgencyColor = getUrgencyColor(item.target_date)

              return (
                <div
                  key={item.id}
                  className={`p-4 border rounded-lg ${urgencyColor} ${
                    timeRemaining.isExpired ? 'ring-2 ring-red-300' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleComplete(item.id, item.is_completed)}
                      disabled={updateItem.isPending}
                      className="w-5 h-5 border-2 border-current rounded-full hover:bg-current hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 disabled:opacity-50 mt-1 flex items-center justify-center"
                      aria-label="Mark as complete"
                    >
                      {item.is_completed && (
                        <svg className="w-3 h-3 text-current" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 space-y-2">
                      {editingId === item.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(item.id)
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                          <input
                            type="datetime-local"
                            value={editTargetDate}
                            onChange={(e) => setEditTargetDate(e.target.value)}
                            min={minDateTime}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className="font-medium cursor-pointer"
                            onClick={() => handleStartEdit(item.id, item.content, item.target_date)}
                          >
                            {item.content}
                          </div>

                          <div className="text-sm opacity-75">
                            Due: {new Date(item.target_date).toLocaleString()}
                          </div>

                          {/* Countdown display */}
                          <div className="font-mono text-lg font-bold">
                            {timeRemaining.isExpired ? (
                              <span className="text-red-600">EXPIRED</span>
                            ) : (
                              <span>
                                {timeRemaining.days > 0 && `${timeRemaining.days}d `}
                                {String(timeRemaining.hours).padStart(2, '0')}:
                                {String(timeRemaining.minutes).padStart(2, '0')}:
                                {String(timeRemaining.seconds).padStart(2, '0')}
                              </span>
                            )}
                          </div>

                          {timeRemaining.isExpired && (
                            <div className="text-sm font-medium text-red-600">
                              This deadline has passed!
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={deleteItem.isPending}
                      className="text-current hover:opacity-75 focus:outline-none disabled:opacity-50"
                      aria-label="Delete item"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
              })}
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
          <div className="space-y-2">
            {completedItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <button
                  onClick={() => handleToggleComplete(item.id, item.is_completed)}
                  disabled={updateItem.isPending}
                  className="w-5 h-5 bg-green-500 border-2 border-green-500 rounded-full flex items-center justify-center hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  aria-label="Mark as incomplete"
                >
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                <div className="flex-1">
                  <span className="text-gray-600 line-through">{item.content}</span>
                  {item.target_date && (
                    <div className="text-xs text-gray-500">
                      Due was: {new Date(item.target_date).toLocaleString()}
                    </div>
                  )}
                  {item.completed_at && (
                    <div className="text-xs text-gray-500">
                      Completed: {new Date(item.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={deleteItem.isPending}
                  className="text-red-600 hover:text-red-800 focus:outline-none disabled:opacity-50"
                  aria-label="Delete item"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400 text-4xl">
            ⏰
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deadlines yet</h3>
          <p className="text-gray-500 mb-4">Add items with deadlines below.</p>
          <p className="text-sm text-gray-400">
            Perfect for project deadlines, event planning, and time-sensitive tasks.
          </p>
        </div>
      )}

      {/* Add new item form - moved to bottom */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700">Add Deadline Item</span>
          <span className="text-xs text-gray-500">
            {pendingItems.length + completedItems.length} of 100 items
          </span>
        </div>
        <form onSubmit={handleAddItem} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              placeholder="Add a deadline item (e.g., 'Submit project proposal')..."
              className="flex-1 px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={createItem.isPending}
              maxLength={500}
            />
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={newItemTargetDate}
                onChange={(e) => setNewItemTargetDate(e.target.value)}
                min={minDateTime}
                className="flex-1 sm:flex-none px-3 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={createItem.isPending}
                required
              />
              <button
                type="submit"
                disabled={createItem.isPending || !newItemContent.trim() || !newItemTargetDate}
                className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base sm:text-sm"
              >
                {createItem.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500">
            Set deadlines for tasks, projects, or events to track time remaining.
          </p>
        </form>
      </div>
    </div>
    </DndContext>
  )
})