import { useQuery } from '@tanstack/react-query'
import { listService } from '../services/list.service'
import type { ListWithItems } from '../types'

export function useList(id: string) {
  return useQuery({
    queryKey: ['list', id],
    queryFn: async (): Promise<ListWithItems> => {
      const { data, error } = await listService.getList(id)
      if (error) {
        throw new Error(error)
      }
      if (!data) {
        throw new Error('List not found')
      }
      return data
    },
    enabled: !!id,
  })
}