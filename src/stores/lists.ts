import { create } from 'zustand'
import { apiService } from '../services/api'
import type { List, ListWithItems, CreateListRequest, UpdateListRequest } from '../types'

interface ListsState {
  lists: List[]
  currentList: ListWithItems | null
  isLoading: boolean
  error: string | null
  
  fetchLists: () => Promise<void>
  fetchList: (id: string) => Promise<void>
  createList: (request: CreateListRequest) => Promise<List | null>
  updateList: (id: string, request: UpdateListRequest) => Promise<void>
  deleteList: (id: string) => Promise<void>
  setCurrentList: (list: ListWithItems | null) => void
  clearError: () => void
}

/**
 * @deprecated Use React Query hooks instead:
 * - useLists() for fetching lists
 * - useListMutations() for list operations
 */
export const useListsStore = create<ListsState>((set, get) => ({
  lists: [],
  currentList: null,
  isLoading: false,
  error: null,

  fetchLists: async () => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.getLists()
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      set({ lists: data || [], isLoading: false })
    }
  },

  fetchList: async (id: string) => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.getList(id)
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      set({ currentList: data, isLoading: false })
    }
  },

  createList: async (request: CreateListRequest) => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.createList(request)
    
    if (error) {
      set({ error, isLoading: false })
      return null
    } else {
      const { lists } = get()
      set({ 
        lists: [data!, ...lists],
        isLoading: false
      })
      return data
    }
  },

  updateList: async (id: string, request: UpdateListRequest) => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.updateList(id, request)
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      const { lists, currentList } = get()
      const updatedLists = lists.map(list => 
        list.id === id ? data! : list
      )
      
      set({ 
        lists: updatedLists,
        currentList: currentList?.id === id ? { ...currentList, ...data! } : currentList,
        isLoading: false
      })
    }
  },

  deleteList: async (id: string) => {
    set({ isLoading: true, error: null })
    
    const { error } = await apiService.deleteList(id)
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      const { lists, currentList } = get()
      const updatedLists = lists.filter(list => list.id !== id)
      
      set({ 
        lists: updatedLists,
        currentList: currentList?.id === id ? null : currentList,
        isLoading: false
      })
    }
  },

  setCurrentList: (list: ListWithItems | null) => {
    set({ currentList: list })
  },

  clearError: () => {
    set({ error: null })
  }
}))