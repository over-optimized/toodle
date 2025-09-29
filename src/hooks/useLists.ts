import { useQuery } from '@tanstack/react-query'
import { listService } from '../services/list.service'
import type { List } from '../types'

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: async (): Promise<List[]> => {
      const { data, error } = await listService.getLists()
      if (error) {
        throw new Error(error)
      }
      return data || []
    },
  })
}