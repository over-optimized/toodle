import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { statusPropagationService } from '../services/status-propagation.service'
import type {
  UpdateItemWithPropagationRequest,
  UpdateItemWithPropagationResponse,
  PreviewStatusPropagationRequest,
  PreviewStatusPropagationResponse,
  Item,
} from '../types'

/**
 * Hook for status updates with automatic propagation
 * Handles parent→child status propagation and real-time sync
 *
 * @param listId - The list context for cache invalidation
 * @returns Mutations and queries for propagation-aware status updates
 */
export function useStatusPropagation(listId: string) {
  const queryClient = useQueryClient()

  // Query: Preview status propagation before applying
  const usePreviewPropagation = (itemId: string, newStatus: boolean) => {
    return useQuery({
      queryKey: ['propagation-preview', itemId, newStatus],
      queryFn: async (): Promise<PreviewStatusPropagationResponse> => {
        const { data, error } = await statusPropagationService.previewPropagation(
          itemId,
          newStatus
        )
        if (error) {
          throw new Error(error)
        }
        return (
          data || {
            would_propagate: false,
            affected_count: 0,
            affected_items: [],
          }
        )
      },
      enabled: !!itemId,
      staleTime: 0, // Always fresh - status can change quickly
    })
  }

  // Mutation: Update item with automatic propagation
  const updateItemWithPropagation = useMutation({
    mutationFn: async (request: UpdateItemWithPropagationRequest) => {
      const { data, error } = await statusPropagationService.updateWithPropagation(request)
      if (error) {
        throw new Error(error)
      }
      return data
    },
    onMutate: async (request) => {
      // Cancel ongoing queries for this item and list
      await queryClient.cancelQueries({ queryKey: ['items', listId] })
      await queryClient.cancelQueries({ queryKey: ['item', request.item_id] })

      // Snapshot current state for rollback
      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])
      const previousItem = previousItems?.find((item) => item.id === request.item_id)

      // Optimistic update: Update item immediately
      if (previousItems && previousItem) {
        queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
          old.map((item) => {
            if (item.id === request.item_id) {
              return {
                ...item,
                content: request.new_content ?? item.content,
                is_completed: request.new_is_completed ?? item.is_completed,
                target_date: request.new_target_date ?? item.target_date,
                position: request.new_position ?? item.position,
                completed_at:
                  request.new_is_completed === true
                    ? new Date().toISOString()
                    : request.new_is_completed === false
                      ? null
                      : item.completed_at,
              }
            }
            return item
          })
        )
      }

      return { previousItems, previousItem }
    },
    onSuccess: (data, request) => {
      if (!data) return

      // Update item cache with real data
      queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
        old.map((item) => (item.id === request.item_id && data.item ? data.item : item))
      )

      // If propagation occurred, invalidate all affected lists
      if (data.propagated_updates && data.propagated_updates.length > 0) {
        // Collect unique list IDs from propagated items
        const affectedListIds = new Set<string>()

        // Invalidate items queries for all affected lists
        data.propagated_updates.forEach((update) => {
          // We don't have list_id in the update, so invalidate all items queries
          // The realtime system will handle updating other lists
        })

        // Invalidate current list
        queryClient.invalidateQueries({ queryKey: ['items', listId] })
        queryClient.invalidateQueries({ queryKey: ['list', listId] })

        // Invalidate all items queries (propagation can affect multiple lists)
        queryClient.invalidateQueries({ queryKey: ['items'] })

        // Show propagation notification
        window.dispatchEvent(
          new CustomEvent('propagation-notification', {
            detail: {
              type: 'status-propagated',
              message: `Status change propagated to ${data.propagated_updates.length} item(s)`,
              affectedCount: data.propagated_updates.length,
              updates: data.propagated_updates,
            },
          })
        )
      } else {
        // No propagation - just invalidate current list
        queryClient.invalidateQueries({ queryKey: ['items', listId] })
        queryClient.invalidateQueries({ queryKey: ['list', listId] })
      }

      // Invalidate link summary if status changed (affects propagation behavior)
      if (request.new_is_completed !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['item', request.item_id, 'link-summary'] })
      }
    },
    onError: (_error, request, context) => {
      // Rollback optimistic update
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }

      // Show error notification
      window.dispatchEvent(
        new CustomEvent('propagation-notification', {
          detail: {
            type: 'propagation-error',
            message: `Failed to update item: ${_error.message}`,
          },
        })
      )
    },
  })

  // Mutation: Update item status only (convenience method)
  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      const { data, error } = await statusPropagationService.updateItemStatus(itemId, isCompleted)
      if (error) {
        throw new Error(error)
      }
      return data
    },
    onMutate: async ({ itemId, isCompleted }) => {
      // Same optimistic update strategy as updateItemWithPropagation
      await queryClient.cancelQueries({ queryKey: ['items', listId] })

      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])

      queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
        old.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              is_completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
            }
          }
          return item
        })
      )

      return { previousItems }
    },
    onSuccess: (data, { itemId }) => {
      if (!data) return

      // Same invalidation strategy as updateItemWithPropagation
      if (data.propagated_updates && data.propagated_updates.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['items'] })

        window.dispatchEvent(
          new CustomEvent('propagation-notification', {
            detail: {
              type: 'status-propagated',
              message: `Status change propagated to ${data.propagated_updates.length} item(s)`,
              affectedCount: data.propagated_updates.length,
              updates: data.propagated_updates,
            },
          })
        )
      } else {
        queryClient.invalidateQueries({ queryKey: ['items', listId] })
      }

      queryClient.invalidateQueries({ queryKey: ['list', listId] })
      queryClient.invalidateQueries({ queryKey: ['item', itemId, 'link-summary'] })
    },
    onError: (_error, _variables, context) => {
      // Rollback
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }

      window.dispatchEvent(
        new CustomEvent('propagation-notification', {
          detail: {
            type: 'propagation-error',
            message: `Failed to update status: ${_error.message}`,
          },
        })
      )
    },
  })

  // Subscribe to propagation events from the service
  useEffect(() => {
    const unsubscribe = statusPropagationService.subscribeToPropagationEvents(
      (event: any) => {
        // When propagation occurs, invalidate affected items
        // This catches propagation from other users or background operations
        queryClient.invalidateQueries({ queryKey: ['items'] })

        // Show notification for background propagation
        window.dispatchEvent(
          new CustomEvent('propagation-notification', {
            detail: {
              type: 'background-propagation',
              message: `Status propagated to ${event.affected_items.length} item(s) across lists`,
              affectedItems: event.affected_items,
            },
          })
        )
      }
    )

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [queryClient])

  return {
    // Mutations
    updateItemWithPropagation,
    updateItemStatus,

    // Preview query factory
    usePreviewPropagation,
  }
}

/**
 * Hook for getting affected items before propagation
 * Useful for showing confirmation dialogs
 *
 * @param itemId - The item that would be updated
 * @param newStatus - The new status value
 * @returns Query with preview data
 */
export function usePropagationPreview(itemId: string | null, newStatus: boolean) {
  return useQuery({
    queryKey: ['propagation-preview', itemId, newStatus],
    queryFn: async (): Promise<PreviewStatusPropagationResponse> => {
      if (!itemId) {
        return {
          would_propagate: false,
          affected_count: 0,
          affected_items: [],
        }
      }

      const { data, error } = await statusPropagationService.previewPropagation(itemId, newStatus)

      if (error) {
        throw new Error(error)
      }

      return (
        data || {
          would_propagate: false,
          affected_count: 0,
          affected_items: [],
        }
      )
    },
    enabled: !!itemId,
    staleTime: 0, // Always fetch fresh preview
  })
}