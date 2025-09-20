import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeManager, type RealtimeChangePayload, type RealtimeSubscription } from '../lib/realtime'
import { useAuthStore } from '../stores'
import type { List, Item } from '../types'

export function useRealtimeList(listId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const subscriptionsRef = useRef<RealtimeSubscription[]>([])

  useEffect(() => {
    if (!listId || !user) {
      return
    }

    // Subscribe to list items changes
    const itemsSubscription = realtimeManager.subscribeToListItems(
      listId,
      (payload: RealtimeChangePayload<Item>) => {
        handleItemChange(payload)
      }
    )

    // Subscribe to list metadata changes
    const listSubscription = realtimeManager.subscribeToLists(
      user.id,
      (payload: RealtimeChangePayload<List>) => {
        if (payload.new?.id === listId || payload.old?.id === listId) {
          handleListChange(payload)
        }
      }
    )

    subscriptionsRef.current = [itemsSubscription, listSubscription]

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe())
      subscriptionsRef.current = []
    }
  }, [listId, user?.id, queryClient])

  const handleItemChange = (payload: RealtimeChangePayload<Item>) => {
    const { eventType, new: newItem, old: oldItem } = payload

    switch (eventType) {
      case 'INSERT':
        if (newItem) {
          // Add new item to the cache
          queryClient.setQueryData(
            ['items', listId],
            (oldData: Item[] | undefined) => {
              if (!oldData) return [newItem]

              // Insert in correct position
              const newData = [...oldData]
              const insertIndex = newData.findIndex(item => item.position > newItem.position)
              if (insertIndex === -1) {
                newData.push(newItem)
              } else {
                newData.splice(insertIndex, 0, newItem)
              }
              return newData
            }
          )

          // Show notification for new items (if not added by current user)
          if (newItem.created_at && new Date(newItem.created_at).getTime() > Date.now() - 5000) {
            window.dispatchEvent(new CustomEvent('realtime-notification', {
              detail: {
                type: 'item-added',
                message: `New item added: "${newItem.content}"`,
                listId
              }
            }))
          }
        }
        break

      case 'UPDATE':
        if (newItem) {
          // Update existing item in cache
          queryClient.setQueryData(
            ['items', listId],
            (oldData: Item[] | undefined) => {
              if (!oldData) return [newItem]

              return oldData.map(item =>
                item.id === newItem.id ? newItem : item
              ).sort((a, b) => a.position - b.position)
            }
          )

          // Show notification for completed items
          if (oldItem && !oldItem.is_completed && newItem.is_completed) {
            window.dispatchEvent(new CustomEvent('realtime-notification', {
              detail: {
                type: 'item-completed',
                message: `Item completed: "${newItem.content}"`,
                listId
              }
            }))
          }
        }
        break

      case 'DELETE':
        if (oldItem) {
          // Remove item from cache
          queryClient.setQueryData(
            ['items', listId],
            (oldData: Item[] | undefined) => {
              if (!oldData) return []
              return oldData.filter(item => item.id !== oldItem.id)
            }
          )

          window.dispatchEvent(new CustomEvent('realtime-notification', {
            detail: {
              type: 'item-deleted',
              message: `Item removed: "${oldItem.content}"`,
              listId
            }
          }))
        }
        break
    }

    // Invalidate list query to update item counts, etc.
    queryClient.invalidateQueries({ queryKey: ['list', listId] })
  }

  const handleListChange = (payload: RealtimeChangePayload<List>) => {
    const { eventType, new: newList, old: oldList } = payload

    switch (eventType) {
      case 'UPDATE':
        if (newList) {
          // Update list in cache
          queryClient.setQueryData(['list', listId], newList)

          // Update in lists cache
          queryClient.setQueryData(
            ['lists'],
            (oldData: List[] | undefined) => {
              if (!oldData) return [newList]
              return oldData.map(list =>
                list.id === newList.id ? newList : list
              )
            }
          )

          // Show notification for title changes
          if (oldList && oldList.title !== newList.title) {
            window.dispatchEvent(new CustomEvent('realtime-notification', {
              detail: {
                type: 'list-updated',
                message: `List renamed to "${newList.title}"`,
                listId
              }
            }))
          }
        }
        break

      case 'DELETE':
        if (oldList) {
          // Remove from all caches
          queryClient.removeQueries({ queryKey: ['list', listId] })
          queryClient.removeQueries({ queryKey: ['items', listId] })

          queryClient.setQueryData(
            ['lists'],
            (oldData: List[] | undefined) => {
              if (!oldData) return []
              return oldData.filter(list => list.id !== oldList.id)
            }
          )

          window.dispatchEvent(new CustomEvent('realtime-notification', {
            detail: {
              type: 'list-deleted',
              message: `List "${oldList.title}" was deleted`,
              listId
            }
          }))
        }
        break
    }
  }

  return {
    isConnected: subscriptionsRef.current.length > 0,
    subscriptionCount: subscriptionsRef.current.length
  }
}

export function useRealtimeListsOverview() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const subscriptionsRef = useRef<RealtimeSubscription[]>([])

  useEffect(() => {
    if (!user) {
      return
    }

    // Subscribe to user's lists changes
    const listsSubscription = realtimeManager.subscribeToLists(
      user.id,
      (payload: RealtimeChangePayload<List>) => {
        handleListsChange(payload)
      }
    )

    // Subscribe to shared lists changes
    const sharedSubscription = realtimeManager.subscribeToSharedLists(
      user.email,
      (payload: RealtimeChangePayload) => {
        // When shares change, invalidate lists to refetch shared lists
        queryClient.invalidateQueries({ queryKey: ['lists'] })
      }
    )

    subscriptionsRef.current = [listsSubscription, sharedSubscription]

    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe())
      subscriptionsRef.current = []
    }
  }, [user?.id, user?.email, queryClient])

  const handleListsChange = (payload: RealtimeChangePayload<List>) => {
    const { eventType, new: newList, old: oldList } = payload

    switch (eventType) {
      case 'INSERT':
        if (newList) {
          queryClient.setQueryData(
            ['lists'],
            (oldData: List[] | undefined) => {
              if (!oldData) return [newList]
              return [newList, ...oldData]
            }
          )
        }
        break

      case 'UPDATE':
        if (newList) {
          queryClient.setQueryData(
            ['lists'],
            (oldData: List[] | undefined) => {
              if (!oldData) return [newList]
              return oldData.map(list =>
                list.id === newList.id ? newList : list
              )
            }
          )
        }
        break

      case 'DELETE':
        if (oldList) {
          queryClient.setQueryData(
            ['lists'],
            (oldData: List[] | undefined) => {
              if (!oldData) return []
              return oldData.filter(list => list.id !== oldList.id)
            }
          )
        }
        break
    }
  }

  return {
    isConnected: subscriptionsRef.current.length > 0,
    subscriptionCount: subscriptionsRef.current.length
  }
}