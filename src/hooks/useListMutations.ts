import { useMutation, useQueryClient } from '@tanstack/react-query'
import { listService } from '../services/list.service'
import type { CreateListRequest, UpdateListRequest } from '../types'

export function useListMutations() {
  const queryClient = useQueryClient()

  const createList = useMutation({
    mutationFn: (request: CreateListRequest) => {
      return listService.createList(request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const updateList = useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateListRequest }) => {
      return listService.updateList(id, request)
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['list', id] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const deleteList = useMutation({
    mutationFn: (id: string) => {
      return listService.deleteList(id)
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.removeQueries({ queryKey: ['list', id] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  return {
    createList,
    updateList,
    deleteList,
  }
}