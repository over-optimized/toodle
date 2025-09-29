import { useMutation, useQueryClient } from '@tanstack/react-query'
import { shareService } from '../services/share.service'
import type { CreateShareRequest } from '../types'

export function useShareMutations(listId: string) {
  const queryClient = useQueryClient()

  const createShare = useMutation({
    mutationFn: (request: CreateShareRequest) => {
      return shareService.createShare(listId, request)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const revokeShare = useMutation({
    mutationFn: (shareId: string) => {
      return shareService.revokeShare(shareId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  const updateShareRole = useMutation({
    mutationFn: ({ shareId, role }: { shareId: string; role: 'read' | 'edit' }) => {
      return shareService.updateShareRole(shareId, role)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] })
    },
    onError: (error: any) => {
      if (error.error) {
        throw new Error(error.error)
      }
      throw error
    },
  })

  return {
    createShare,
    revokeShare,
    updateShareRole,
  }
}