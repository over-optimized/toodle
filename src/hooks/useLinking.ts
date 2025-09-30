import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enhancedLinkingService } from '../services/enhanced-linking.service'
import type {
  CreateParentChildLinkRequest,
  RemoveParentChildLinkRequest,
  LinkedItemInfo,
  ItemLinkSummary,
} from '../types'

/**
 * Hook for managing parent-child hierarchical links
 * Provides queries for link data and mutations for link operations
 *
 * @param itemId - The item to manage links for
 * @returns Queries and mutations for link management
 */
export function useLinking(itemId: string) {
  const queryClient = useQueryClient()

  // Query: Get child items
  const childItems = useQuery({
    queryKey: ['item', itemId, 'children'],
    queryFn: async (): Promise<LinkedItemInfo[]> => {
      const { data, error } = await enhancedLinkingService.getChildItems(itemId)
      if (error) {
        throw new Error(error)
      }
      return data || []
    },
    enabled: !!itemId,
    staleTime: 30000, // 30 seconds - links don't change frequently
  })

  // Query: Get parent items
  const parentItems = useQuery({
    queryKey: ['item', itemId, 'parents'],
    queryFn: async (): Promise<LinkedItemInfo[]> => {
      const { data, error } = await enhancedLinkingService.getParentItems(itemId)
      if (error) {
        throw new Error(error)
      }
      return data || []
    },
    enabled: !!itemId,
    staleTime: 30000,
  })

  // Query: Get complete link summary
  const linkSummary = useQuery({
    queryKey: ['item', itemId, 'link-summary'],
    queryFn: async (): Promise<ItemLinkSummary> => {
      const { data, error } = await enhancedLinkingService.getLinkSummary(itemId)
      if (error) {
        throw new Error(error)
      }
      return data || {
        item_id: itemId,
        total_links: 0,
        children_count: 0,
        parents_count: 0,
        bidirectional_count: 0,
        children: [],
        parents: [],
        bidirectional: [],
      }
    },
    enabled: !!itemId,
    staleTime: 30000,
  })

  // Mutation: Create parent-child links
  const createParentChildLink = useMutation({
    mutationFn: async (request: CreateParentChildLinkRequest) => {
      const result = await enhancedLinkingService.createParentChildLinks(request)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onMutate: async (request) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['item', request.parent_item_id] })

      // Snapshot current data for rollback
      const previousChildren = queryClient.getQueryData<LinkedItemInfo[]>([
        'item',
        request.parent_item_id,
        'children',
      ])

      // Optimistic update: Add children immediately
      queryClient.setQueryData<LinkedItemInfo[]>(
        ['item', request.parent_item_id, 'children'],
        (old = []) => {
          // We don't have full LinkedItemInfo yet, so just add placeholders
          // Real data will come from onSuccess
          return old
        }
      )

      return { previousChildren }
    },
    onSuccess: (_data, request) => {
      // Invalidate all affected queries
      queryClient.invalidateQueries({ queryKey: ['item', request.parent_item_id, 'children'] })
      queryClient.invalidateQueries({ queryKey: ['item', request.parent_item_id, 'link-summary'] })

      // Invalidate parent queries for each child
      request.child_item_ids.forEach((childId) => {
        queryClient.invalidateQueries({ queryKey: ['item', childId, 'parents'] })
        queryClient.invalidateQueries({ queryKey: ['item', childId, 'link-summary'] })
      })

      // Invalidate list items cache (to update LinkIndicator components)
      // We need to get the list IDs from the items, but we don't have them here
      // So we invalidate all items queries (safe but broader than needed)
      queryClient.invalidateQueries({ queryKey: ['items'] })

      // Show success notification
      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'link-created',
            message: `Created ${request.child_item_ids.length} parent-child link(s)`,
          },
        })
      )
    },
    onError: (_error, _request, context) => {
      // Rollback optimistic update
      if (context?.previousChildren) {
        queryClient.setQueryData(
          ['item', _request.parent_item_id, 'children'],
          context.previousChildren
        )
      }

      // Show error notification
      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'link-error',
            message: `Failed to create link: ${_error.message}`,
          },
        })
      )
    },
  })

  // Mutation: Remove parent-child link
  const removeParentChildLink = useMutation({
    mutationFn: async (request: RemoveParentChildLinkRequest) => {
      const result = await enhancedLinkingService.removeParentChildLink(request)
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onMutate: async (request) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['item', request.parent_item_id] })
      await queryClient.cancelQueries({ queryKey: ['item', request.child_item_id] })

      // Snapshot for rollback
      const previousChildren = queryClient.getQueryData<LinkedItemInfo[]>([
        'item',
        request.parent_item_id,
        'children',
      ])
      const previousParents = queryClient.getQueryData<LinkedItemInfo[]>([
        'item',
        request.child_item_id,
        'parents',
      ])

      // Optimistic update: Remove link immediately
      queryClient.setQueryData<LinkedItemInfo[]>(
        ['item', request.parent_item_id, 'children'],
        (old = []) => old.filter((child) => child.id !== request.child_item_id)
      )

      queryClient.setQueryData<LinkedItemInfo[]>(
        ['item', request.child_item_id, 'parents'],
        (old = []) => old.filter((parent) => parent.id !== request.parent_item_id)
      )

      return { previousChildren, previousParents }
    },
    onSuccess: (_data, request) => {
      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: ['item', request.parent_item_id, 'children'] })
      queryClient.invalidateQueries({ queryKey: ['item', request.parent_item_id, 'link-summary'] })
      queryClient.invalidateQueries({ queryKey: ['item', request.child_item_id, 'parents'] })
      queryClient.invalidateQueries({ queryKey: ['item', request.child_item_id, 'link-summary'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })

      // Show success notification
      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'link-removed',
            message: 'Parent-child link removed',
          },
        })
      )
    },
    onError: (_error, request, context) => {
      // Rollback optimistic updates
      if (context?.previousChildren) {
        queryClient.setQueryData(
          ['item', request.parent_item_id, 'children'],
          context.previousChildren
        )
      }
      if (context?.previousParents) {
        queryClient.setQueryData(
          ['item', request.child_item_id, 'parents'],
          context.previousParents
        )
      }

      // Show error notification
      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'link-error',
            message: `Failed to remove link: ${_error.message}`,
          },
        })
      )
    },
  })

  // Mutation: Bulk create links (for multiple children at once)
  const bulkCreateLinks = useMutation({
    mutationFn: async (request: CreateParentChildLinkRequest) => {
      // Use batch creation if available, otherwise fall back to single call
      const result = await enhancedLinkingService.batchCreateLinks(
        request.parent_item_id,
        request.child_item_ids
      )
      if (result.error) {
        throw new Error(result.error)
      }
      return result.data
    },
    onSuccess: (_data, request) => {
      // Same invalidation strategy as single create
      queryClient.invalidateQueries({ queryKey: ['item', request.parent_item_id] })
      request.child_item_ids.forEach((childId) => {
        queryClient.invalidateQueries({ queryKey: ['item', childId] })
      })
      queryClient.invalidateQueries({ queryKey: ['items'] })

      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'bulk-links-created',
            message: `Created ${request.child_item_ids.length} links successfully`,
          },
        })
      )
    },
    onError: (_error) => {
      window.dispatchEvent(
        new CustomEvent('link-notification', {
          detail: {
            type: 'link-error',
            message: `Bulk link creation failed: ${_error.message}`,
          },
        })
      )
    },
  })

  return {
    // Queries
    childItems,
    parentItems,
    linkSummary,

    // Mutations
    createParentChildLink,
    removeParentChildLink,
    bulkCreateLinks,

    // Helper flags
    hasLinks: (linkSummary.data?.total_links || 0) > 0,
    isParent: (linkSummary.data?.children_count || 0) > 0,
    isChild: (linkSummary.data?.parents_count || 0) > 0,
  }
}

/**
 * Hook for checking if an item has any parent-child relationships
 * Lightweight query for quick checks without fetching full link details
 *
 * @param itemId - The item to check
 * @returns Query with boolean result
 */
export function useHasParentChildLinks(itemId: string) {
  return useQuery({
    queryKey: ['item', itemId, 'has-parent-child-links'],
    queryFn: async (): Promise<boolean> => {
      const result = await enhancedLinkingService.hasRelationships(itemId)
      if (result.error) {
        return false // Default to false on error
      }
      return result.data ?? false
    },
    enabled: !!itemId,
    staleTime: 30000,
  })
}