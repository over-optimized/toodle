import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itemService } from '../services/item.service'
import { enhancedLinkingService } from '../services/enhanced-linking.service'
import type { Item, CreateItemRequest, UpdateItemRequest, ItemLinkSummary } from '../types'
import { getLinkCounts } from '../types/enhanced-linking'

/**
 * Enhanced hook for fetching items with link metadata
 * Provides optimistic updates and link-aware caching
 *
 * @param listId - The list to fetch items for
 * @returns Query with items and link metadata
 */
export function useItems(listId: string) {
  return useQuery({
    queryKey: ['items', listId],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await itemService.getItemsByListId(listId)
      if (error) {
        throw new Error(error)
      }
      return data || []
    },
    enabled: !!listId,
    // Add link counts to each item for UI convenience
    select: (items) =>
      items.map((item) => ({
        ...item,
        _linkCounts: getLinkCounts(item.linked_items),
      })),
  })
}

/**
 * Extended hook that includes link summary data for each item
 * Use when you need detailed link information in the UI
 *
 * @param listId - The list to fetch items for
 * @returns Query with items and enriched link data
 */
export function useItemsWithLinkDetails(listId: string) {
  return useQuery({
    queryKey: ['items-with-links', listId],
    queryFn: async (): Promise<Array<Item & { _linkSummary?: ItemLinkSummary }>> => {
      const { data: items, error } = await itemService.getItemsByListId(listId)
      if (error) {
        throw new Error(error)
      }
      if (!items) return []

      // Fetch link summaries for all items that have links
      const itemsWithLinks = await Promise.all(
        items.map(async (item) => {
          const linkCounts = getLinkCounts(item.linked_items)
          if (linkCounts.total > 0) {
            const { data: summary } = await enhancedLinkingService.getLinkSummary(item.id)
            return {
              ...item,
              _linkSummary: summary || undefined,
            }
          }
          return item
        })
      )

      return itemsWithLinks
    },
    enabled: !!listId,
    staleTime: 30000, // 30 seconds - link details don't change frequently
  })
}

/**
 * Hook for item mutations with optimistic updates and propagation support
 * Combines create, update, delete, and reorder operations
 *
 * @param listId - The list context for mutations
 * @returns Mutation functions with optimistic updates
 */
export function useItemMutations(listId: string) {
  const queryClient = useQueryClient()

  // Create item mutation
  const createItem = useMutation({
    mutationFn: async (request: CreateItemRequest) => {
      const result = await itemService.createItem(listId, request)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onMutate: async (request) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['items', listId] })

      // Snapshot for rollback
      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])

      // Optimistic update: Add item immediately
      const tempId = `temp-${Date.now()}`
      const optimisticItem: Item = {
        id: tempId,
        list_id: listId,
        content: request.content,
        position: request.position ?? 999,
        is_completed: false,
        target_date: request.target_date,
        completed_at: undefined,
        linked_items: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Item[]>(['items', listId], (old = []) => [...old, optimisticItem])

      return { previousItems, tempId }
    },
    onSuccess: (data, _request, context) => {
      // Replace optimistic item with real data
      if (data && context) {
        queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
          old.map((item) => (item.id === context.tempId ? data : item))
        )
      }

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (_error, _request, context) => {
      // Rollback optimistic update
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },
  })

  // Update item mutation (without propagation)
  const updateItem = useMutation({
    mutationFn: async ({ id, request }: { id: string; request: UpdateItemRequest }) => {
      const result = await itemService.updateItem(id, request)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onMutate: async ({ id, request }) => {
      await queryClient.cancelQueries({ queryKey: ['items', listId] })

      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])

      // Optimistic update
      queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
        old.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              ...request,
              completed_at:
                request.is_completed === true
                  ? new Date().toISOString()
                  : request.is_completed === false
                    ? null
                    : item.completed_at,
              updated_at: new Date().toISOString(),
            }
          }
          return item
        })
      )

      return { previousItems }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },
  })

  // Delete item mutation
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const result = await itemService.deleteItem(id)
      if (result.error) {
        throw new Error(result.error)
      }
      return result
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['items', listId] })

      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])

      // Optimistic update: Remove item immediately
      queryClient.setQueryData<Item[]>(['items', listId], (old = []) =>
        old.filter((item) => item.id !== id)
      )

      return { previousItems }
    },
    onSuccess: (_data, id) => {
      // Invalidate link caches for linked items
      queryClient.invalidateQueries({ queryKey: ['item', id] })
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (_error, _id, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },
  })

  // Reorder items mutation
  const reorderItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const result = await itemService.reorderItems(listId, itemIds)
      if (result.error) {
        throw new Error(result.error)
      }
      return result
    },
    onMutate: async (itemIds) => {
      await queryClient.cancelQueries({ queryKey: ['items', listId] })

      const previousItems = queryClient.getQueryData<Item[]>(['items', listId])

      // Optimistic update: Reorder immediately
      queryClient.setQueryData<Item[]>(['items', listId], (old = []) => {
        const itemMap = new Map(old.map((item) => [item.id, item]))
        return itemIds
          .map((id, index) => {
            const item = itemMap.get(id)
            if (item) {
              return {
                ...item,
                position: index,
              }
            }
            return null
          })
          .filter((item): item is Item => item !== null)
      })

      return { previousItems }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', listId], context.previousItems)
      }
    },
  })

  return {
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
  }
}