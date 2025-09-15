import { create } from 'zustand'
import { apiService } from '../services/api'
import type { Item, CreateItemRequest, UpdateItemRequest } from '../types'
import { useListsStore } from './lists'

interface ItemsState {
  isLoading: boolean
  error: string | null
  
  createItem: (listId: string, request: CreateItemRequest) => Promise<Item | null>
  updateItem: (id: string, request: UpdateItemRequest) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  toggleItemCompletion: (id: string) => Promise<void>
  clearError: () => void
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  isLoading: false,
  error: null,

  createItem: async (listId: string, request: CreateItemRequest) => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.createItem(listId, request)
    
    if (error) {
      set({ error, isLoading: false })
      return null
    } else {
      const { currentList } = useListsStore.getState()
      if (currentList && currentList.id === listId) {
        useListsStore.getState().setCurrentList({
          ...currentList,
          items: [...currentList.items, data!]
        })
      }
      set({ isLoading: false })
      return data
    }
  },

  updateItem: async (id: string, request: UpdateItemRequest) => {
    set({ isLoading: true, error: null })
    
    const { data, error } = await apiService.updateItem(id, request)
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      const { currentList } = useListsStore.getState()
      if (currentList) {
        const updatedItems = currentList.items.map(item => 
          item.id === id ? data! : item
        )
        useListsStore.getState().setCurrentList({
          ...currentList,
          items: updatedItems
        })
      }
      set({ isLoading: false })
    }
  },

  deleteItem: async (id: string) => {
    set({ isLoading: true, error: null })
    
    const { error } = await apiService.deleteItem(id)
    
    if (error) {
      set({ error, isLoading: false })
    } else {
      const { currentList } = useListsStore.getState()
      if (currentList) {
        const updatedItems = currentList.items.filter(item => item.id !== id)
        useListsStore.getState().setCurrentList({
          ...currentList,
          items: updatedItems
        })
      }
      set({ isLoading: false })
    }
  },

  toggleItemCompletion: async (id: string) => {
    const { currentList } = useListsStore.getState()
    if (!currentList) return
    
    const item = currentList.items.find(item => item.id === id)
    if (!item) return
    
    await get().updateItem(id, { is_completed: !item.is_completed })
  },

  clearError: () => {
    set({ error: null })
  }
}))