import { useMutation, useQueryClient } from '@tanstack/react-query'
import { itemService } from '../services/item.service'
import type { CreateItemRequest, UpdateItemRequest } from '../types'

export function useItemMutations(listId: string) {
  const queryClient = useQueryClient()

  const createItem = useMutation({
    mutationFn: (request: CreateItemRequest) => {
      return itemService.createItem(listId, request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const updateItem = useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateItemRequest }) => {
      return itemService.updateItem(id, request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => {
      return itemService.deleteItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const reorderItems = useMutation({
    mutationFn: (itemIds: string[]) => {
      return itemService.reorderItems(listId, itemIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', listId] })
      queryClient.invalidateQueries({ queryKey: ['list', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  return {
    createItem,
    updateItem,
    deleteItem,
    reorderItems,
  }
}