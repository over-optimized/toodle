import { offlineDb, type PendingOperation } from '../lib/offline-db'
import { listService } from './list.service'
import { itemService } from './item.service'
import { shareService } from './share.service'
import { backgroundSync } from '../lib/background-sync'
import { syncService } from './sync.service'
import type { List, Item, CreateListRequest, CreateItemRequest, UpdateListRequest, UpdateItemRequest } from '../types'

export class OfflineService {
  private isOnline = navigator.onLine
  private syncInProgress = false
  private retryTimeouts = new Map<number, NodeJS.Timeout>()

  constructor() {
    this.setupOnlineStatusListeners()
    this.startPeriodicSync()
  }

  private async requestBackgroundSync(): Promise<void> {
    if (!this.isOnline) {
      await backgroundSync.requestSync()
    }
  }

  private setupOnlineStatusListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncPendingOperations()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncPendingOperations()
      }
    }, 30000) // Sync every 30 seconds
  }

  async createList(request: CreateListRequest): Promise<{ data: List | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await listService.createList(request)
        if (result.data) {
          await offlineDb.saveList(result.data)
          await offlineDb.markSynced('lists', result.data.id)
        }
        return result
      } else {
        const tempId = `temp_${Date.now()}`
        const tempList: List = {
          id: tempId,
          user_id: 'current_user', // Will be replaced during sync
          title: request.title,
          type: request.type,
          is_private: request.is_private ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        await offlineDb.saveList(tempList)
        await offlineDb.queueOperation({
          type: 'create',
          table: 'lists',
          recordId: tempId,
          data: request
        })

        await this.requestBackgroundSync()
        return { data: tempList, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create list'
      }
    }
  }

  async updateList(id: string, request: UpdateListRequest): Promise<{ data: List | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await listService.updateList(id, request)
        if (result.data) {
          await offlineDb.saveList(result.data)
          await offlineDb.markSynced('lists', result.data.id)
        }
        return result
      } else {
        const existingList = await offlineDb.lists.get(id)
        if (!existingList) {
          return { data: null, error: 'List not found' }
        }

        const updatedList: List = {
          ...existingList,
          ...request,
          updated_at: new Date().toISOString()
        }

        await offlineDb.saveList(updatedList)
        await offlineDb.queueOperation({
          type: 'update',
          table: 'lists',
          recordId: id,
          data: request
        })

        await this.requestBackgroundSync()
        return { data: updatedList, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update list'
      }
    }
  }

  async deleteList(id: string): Promise<{ error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await listService.deleteList(id)
        if (!result.error) {
          await offlineDb.lists.delete(id)
          await offlineDb.items.where('list_id').equals(id).delete()
          await offlineDb.shares.where('list_id').equals(id).delete()
        }
        return result
      } else {
        await offlineDb.lists.delete(id)
        await offlineDb.items.where('list_id').equals(id).delete()
        await offlineDb.shares.where('list_id').equals(id).delete()

        await offlineDb.queueOperation({
          type: 'delete',
          table: 'lists',
          recordId: id
        })

        await this.requestBackgroundSync()
        return { error: null }
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to delete list'
      }
    }
  }

  async createItem(listId: string, request: CreateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await itemService.createItem(listId, request)
        if (result.data) {
          await offlineDb.saveItem(result.data)
          await offlineDb.markSynced('items', result.data.id)
        }
        return result
      } else {
        const tempId = `temp_${Date.now()}`
        const position = request.position ?? await this.getNextItemPosition(listId)

        const tempItem: Item = {
          id: tempId,
          list_id: listId,
          content: request.content,
          is_completed: false,
          completed_at: undefined,
          target_date: request.target_date || undefined,
          position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        await offlineDb.saveItem(tempItem)
        await offlineDb.queueOperation({
          type: 'create',
          table: 'items',
          recordId: tempId,
          data: { ...request, list_id: listId }
        })

        await this.requestBackgroundSync()
        return { data: tempItem, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create item'
      }
    }
  }

  async updateItem(id: string, request: UpdateItemRequest): Promise<{ data: Item | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await itemService.updateItem(id, request)
        if (result.data) {
          await offlineDb.saveItem(result.data)
          await offlineDb.markSynced('items', result.data.id)
        }
        return result
      } else {
        const existingItem = await offlineDb.items.get(id)
        if (!existingItem) {
          return { data: null, error: 'Item not found' }
        }

        const updatedItem: Item = {
          ...existingItem,
          ...request,
          completed_at: request.is_completed ? new Date().toISOString() : (request.is_completed === false ? undefined : existingItem.completed_at),
          updated_at: new Date().toISOString()
        }

        await offlineDb.saveItem(updatedItem)
        await offlineDb.queueOperation({
          type: 'update',
          table: 'items',
          recordId: id,
          data: request
        })

        await this.requestBackgroundSync()
        return { data: updatedItem, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update item'
      }
    }
  }

  async deleteItem(id: string): Promise<{ error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await itemService.deleteItem(id)
        if (!result.error) {
          await offlineDb.items.delete(id)
        }
        return result
      } else {
        await offlineDb.items.delete(id)
        await offlineDb.queueOperation({
          type: 'delete',
          table: 'items',
          recordId: id
        })

        await this.requestBackgroundSync()
        return { error: null }
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to delete item'
      }
    }
  }

  async getUserLists(userId: string): Promise<{ data: List[] | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await listService.getLists()
        if (result.data) {
          for (const list of result.data) {
            await offlineDb.saveList(list)
            await offlineDb.markSynced('lists', list.id)
          }
        }
        return result
      } else {
        const lists = await offlineDb.getUserLists(userId)
        return { data: lists, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch lists'
      }
    }
  }

  async getListItems(listId: string): Promise<{ data: Item[] | null; error: string | null }> {
    try {
      if (this.isOnline) {
        const result = await itemService.getItemsByListId(listId)
        if (result.data) {
          for (const item of result.data) {
            await offlineDb.saveItem(item)
            await offlineDb.markSynced('items', item.id)
          }
        }
        return result
      } else {
        const items = await offlineDb.getListItems(listId)
        return { data: items, error: null }
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch items'
      }
    }
  }

  private async getNextItemPosition(listId: string): Promise<number> {
    const items = await offlineDb.getListItems(listId)
    return Math.max(...items.map(item => item.position), 0) + 1
  }

  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return
    }

    this.syncInProgress = true

    try {
      // First, detect and resolve conflicts
      const conflicts = await syncService.detectConflicts()
      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} conflicts, resolving...`)
        await syncService.resolveConflicts(conflicts)
      }

      // Then process pending operations
      const operations = await offlineDb.getPendingOperations()

      for (const operation of operations) {
        try {
          await this.executePendingOperation(operation)
          await offlineDb.markOperationComplete(operation.id!)
        } catch (error) {
          console.error('Failed to sync operation:', operation, error)

          if (operation.retryCount < 3) {
            await offlineDb.incrementRetryCount(
              operation.id!,
              error instanceof Error ? error.message : 'Unknown error'
            )

            this.scheduleRetry(operation.id!, operation.retryCount + 1)
          } else {
            console.error('Max retries exceeded for operation:', operation)
            await offlineDb.markOperationComplete(operation.id!)
          }
        }
      }
    } finally {
      this.syncInProgress = false
    }
  }

  private async executePendingOperation(operation: PendingOperation): Promise<void> {
    switch (operation.table) {
      case 'lists':
        await this.executePendingListOperation(operation)
        break
      case 'items':
        await this.executePendingItemOperation(operation)
        break
      case 'shares':
        await this.executePendingShareOperation(operation)
        break
    }
  }

  private async executePendingListOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const createResult = await listService.createList(operation.data)
        if (createResult.data && createResult.data.id !== operation.recordId) {
          await offlineDb.lists.delete(operation.recordId)
          await offlineDb.saveList(createResult.data)
          await offlineDb.markSynced('lists', createResult.data.id)
        }
        break
      }
      case 'update':
        await listService.updateList(operation.recordId, operation.data)
        await offlineDb.markSynced('lists', operation.recordId)
        break
      case 'delete':
        await listService.deleteList(operation.recordId)
        break
    }
  }

  private async executePendingItemOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const createResult = await itemService.createItem(operation.data.list_id, operation.data)
        if (createResult.data && createResult.data.id !== operation.recordId) {
          await offlineDb.items.delete(operation.recordId)
          await offlineDb.saveItem(createResult.data)
          await offlineDb.markSynced('items', createResult.data.id)
        }
        break
      }
      case 'update':
        await itemService.updateItem(operation.recordId, operation.data)
        await offlineDb.markSynced('items', operation.recordId)
        break
      case 'delete':
        await itemService.deleteItem(operation.recordId)
        break
    }
  }

  private async executePendingShareOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case 'create': {
        const createResult = await shareService.createShare(operation.data.list_id, operation.data)
        if (createResult.data && createResult.data.id !== operation.recordId) {
          await offlineDb.shares.delete(operation.recordId)
          await offlineDb.saveShare(createResult.data)
          await offlineDb.markSynced('shares', createResult.data.id)
        }
        break
      }
      case 'delete':
        await shareService.deleteShare(operation.recordId)
        break
    }
  }

  private scheduleRetry(operationId: number, retryCount: number): void {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000) // Exponential backoff, max 30s

    const timeout = setTimeout(async () => {
      if (this.isOnline) {
        try {
          const operation = await offlineDb.pendingOperations.get(operationId)
          if (operation) {
            await this.executePendingOperation(operation)
            await offlineDb.markOperationComplete(operationId)
          }
        } catch (error) {
          if (retryCount < 3) {
            await offlineDb.incrementRetryCount(
              operationId,
              error instanceof Error ? error.message : 'Unknown error'
            )
            this.scheduleRetry(operationId, retryCount + 1)
          }
        }
      }
      this.retryTimeouts.delete(operationId)
    }, delay)

    this.retryTimeouts.set(operationId, timeout)
  }

  isOffline(): boolean {
    return !this.isOnline
  }

  async getPendingOperationsCount(): Promise<number> {
    const operations = await offlineDb.getPendingOperations()
    return operations.length
  }

  async getQueueStatus(): Promise<{
    pending: number
    failed: number
    lastSync: Date | null
    isOnline: boolean
    syncInProgress: boolean
  }> {
    const operations = await offlineDb.getPendingOperations()
    const failedOps = operations.filter(op => op.retryCount >= 3)

    return {
      pending: operations.length,
      failed: failedOps.length,
      lastSync: null, // Could store this in localStorage
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress
    }
  }

  async clearPendingOperations(): Promise<void> {
    await offlineDb.pendingOperations.clear()
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts.clear()
  }

  async forceSync(): Promise<void> {
    if (this.isOnline) {
      await this.syncPendingOperations()
    } else {
      throw new Error('Cannot sync while offline')
    }
  }
}

export const offlineService = new OfflineService()