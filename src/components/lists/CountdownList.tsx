import { useState, useEffect } from 'react'
import { useItems, useItemMutations } from '../../hooks'
import { useRealtimeList, usePresence } from '../../hooks'
import type { List } from '../../types'

interface CountdownListProps {
  list: List
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const formatTimeRemaining = (targetDate: string): TimeRemaining & { isExpired: boolean } => {
  const now = new Date().getTime()
  const target = new Date(targetDate).getTime()
  const difference = target - now

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((difference % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, isExpired: false }
}

const getUrgencyColor = (targetDate: string): string => {
  const now = new Date().getTime()
  const target = new Date(targetDate).getTime()
  const hoursRemaining = (target - now) / (1000 * 60 * 60)

  if (hoursRemaining <= 0) return 'text-red-600 bg-red-50 border-red-200' // Expired
  if (hoursRemaining <= 24) return 'text-red-600 bg-red-50 border-red-200' // Critical (< 1 day)
  if (hoursRemaining <= 72) return 'text-orange-600 bg-orange-50 border-orange-200' // Warning (< 3 days)
  if (hoursRemaining <= 168) return 'text-yellow-600 bg-yellow-50 border-yellow-200' // Attention (< 1 week)
  return 'text-green-600 bg-green-50 border-green-200' // Safe
}

export function CountdownList({ list }: CountdownListProps) {
  const [newItemContent, setNewItemContent] = useState('')
  const [newItemTargetDate, setNewItemTargetDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  const { data: items = [], isLoading, error } = useItems(list.id)
  const { createItem, updateItem, deleteItem } = useItemMutations()
  const { otherUsers, onlineCount } = usePresence(list.id)

  // Enable real-time updates
  useRealtimeList(list.id)

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemContent.trim() || !newItemTargetDate) return

    // Validate that target date is in the future
    const targetDate = new Date(newItemTargetDate)
    if (targetDate <= new Date()) {
      alert('Target date must be in the future')
      return
    }

    try {
      const position = Math.max(...items.map(item => item.position), 0) + 1

      await createItem.mutateAsync({
        listId: list.id,
        item: {
          content: newItemContent.trim(),
          position,
          target_date: targetDate.toISOString()
        }
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
        updates: { is_completed: !isCompleted }
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
        updates
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

  // Sort items by target date (earliest first)
  const sortedItems = [...items].sort((a, b) => {
    if (!a.target_date) return 1
    if (!b.target_date) return -1
    return new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
  })

  const pendingItems = sortedItems.filter(item => !item.is_completed)
  const completedItems = sortedItems.filter(item => item.is_completed)

  // Get the minimum date for new items (now + 1 minute)
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16)

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

      {/* Add new item form */}
      <form onSubmit={handleAddItem} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemContent}
            onChange={(e) => setNewItemContent(e.target.value)}
            placeholder="Add a deadline item (e.g., 'Submit project proposal')..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={createItem.isPending}
          />
          <input
            type="datetime-local"
            value={newItemTargetDate}
            onChange={(e) => setNewItemTargetDate(e.target.value)}
            min={minDateTime}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={createItem.isPending}
            required
          />
          <button
            type="submit"
            disabled={createItem.isPending || !newItemContent.trim() || !newItemTargetDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createItem.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Set deadlines for tasks, projects, or events to track time remaining.
        </p>
      </form>

      {/* Pending items with countdowns */}
      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">
            Active Deadlines ({pendingItems.length})
          </h3>
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
                      className="w-5 h-5 border-2 border-current rounded-full hover:bg-current hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 disabled:opacity-50 mt-1"
                      aria-label="Mark as complete"
                    />

                    <div className="flex-1 space-y-2">
                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <input
                            type="datetime-local"
                            value={editTargetDate}
                            onChange={(e) => setEditTargetDate(e.target.value)}
                            min={minDateTime}
                            className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
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
          <p className="text-gray-500 mb-4">Add items with deadlines to track time remaining.</p>
          <p className="text-sm text-gray-400">
            Perfect for project deadlines, event planning, and time-sensitive tasks.
          </p>
        </div>
      )}
    </div>
  )
}