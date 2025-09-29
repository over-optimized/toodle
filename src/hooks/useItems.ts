import { useQuery } from '@tanstack/react-query'
import { itemService } from '../services/item.service'
import type { Item } from '../types'

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
  })
}