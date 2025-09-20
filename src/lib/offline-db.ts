import Dexie, { Table } from 'dexie'
import type { List, Item, Share } from '../types'

export interface OfflineList extends List {
  _syncStatus: 'synced' | 'pending' | 'conflict'
  _lastModified: number
}

export interface OfflineItem extends Item {
  _syncStatus: 'synced' | 'pending' | 'conflict'
  _lastModified: number
}

export interface OfflineShare extends Share {
  _syncStatus: 'synced' | 'pending' | 'conflict'
  _lastModified: number
}

export interface PendingOperation {
  id?: number
  type: 'create' | 'update' | 'delete'
  table: 'lists' | 'items' | 'shares'
  recordId: string
  data?: any
  timestamp: number
  retryCount: number
  lastError?: string
}

export class OfflineDatabase extends Dexie {
  lists!: Table<OfflineList>
  items!: Table<OfflineItem>
  shares!: Table<OfflineShare>
  pendingOperations!: Table<PendingOperation>

  constructor() {
    super('ToodleOfflineDB')

    this.version(1).stores({
      lists: 'id, user_id, type, title, is_private, _syncStatus, _lastModified',
      items: 'id, list_id, content, is_completed, position, _syncStatus, _lastModified',
      shares: 'id, list_id, shared_with_email, role, created_by, _syncStatus, _lastModified',
      pendingOperations: '++id, type, table, recordId, timestamp, retryCount'
    })

    this.version(2).stores({
      lists: 'id, user_id, type, title, is_private, _syncStatus, _lastModified, created_at, updated_at',
      items: 'id, list_id, content, is_completed, completed_at, target_date, position, _syncStatus, _lastModified, created_at, updated_at',
      shares: 'id, list_id, shared_with_email, role, created_by, expires_at, _syncStatus, _lastModified, created_at',
      pendingOperations: '++id, type, table, recordId, timestamp, retryCount, lastError'
    })
  }

  async saveList(list: List): Promise<OfflineList> {
    const offlineList: OfflineList = {
      ...list,
      _syncStatus: 'pending',
      _lastModified: Date.now()
    }

    await this.lists.put(offlineList)
    return offlineList
  }

  async saveItem(item: Item): Promise<OfflineItem> {
    const offlineItem: OfflineItem = {
      ...item,
      _syncStatus: 'pending',
      _lastModified: Date.now()
    }

    await this.items.put(offlineItem)
    return offlineItem
  }

  async saveShare(share: Share): Promise<OfflineShare> {
    const offlineShare: OfflineShare = {
      ...share,
      _syncStatus: 'pending',
      _lastModified: Date.now()
    }

    await this.shares.put(offlineShare)
    return offlineShare
  }

  async queueOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    await this.pendingOperations.add({
      ...operation,
      timestamp: Date.now(),
      retryCount: 0
    })
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    return this.pendingOperations.orderBy('timestamp').toArray()
  }

  async markOperationComplete(operationId: number): Promise<void> {
    await this.pendingOperations.delete(operationId)
  }

  async incrementRetryCount(operationId: number, error?: string): Promise<void> {
    const operation = await this.pendingOperations.get(operationId)
    if (operation) {
      await this.pendingOperations.update(operationId, {
        retryCount: operation.retryCount + 1,
        lastError: error
      })
    }
  }

  async markSynced(table: 'lists' | 'items' | 'shares', recordId: string): Promise<void> {
    const tableRef = this[table] as Table<OfflineList | OfflineItem | OfflineShare>
    await tableRef.update(recordId, {
      _syncStatus: 'synced'
    })
  }

  async markConflict(table: 'lists' | 'items' | 'shares', recordId: string): Promise<void> {
    const tableRef = this[table] as Table<OfflineList | OfflineItem | OfflineShare>
    await tableRef.update(recordId, {
      _syncStatus: 'conflict'
    })
  }

  async getUserLists(userId: string): Promise<OfflineList[]> {
    return this.lists.where('user_id').equals(userId).toArray()
  }

  async getListItems(listId: string): Promise<OfflineItem[]> {
    return this.items.where('list_id').equals(listId).orderBy('position').toArray()
  }

  async getListShares(listId: string): Promise<OfflineShare[]> {
    return this.shares.where('list_id').equals(listId).toArray()
  }

  async clearUserData(userId: string): Promise<void> {
    await this.transaction('rw', this.lists, this.items, this.shares, this.pendingOperations, async () => {
      await this.lists.where('user_id').equals(userId).delete()
      const userLists = await this.lists.where('user_id').equals(userId).toArray()
      const listIds = userLists.map(list => list.id)

      for (const listId of listIds) {
        await this.items.where('list_id').equals(listId).delete()
        await this.shares.where('list_id').equals(listId).delete()
      }

      await this.pendingOperations.clear()
    })
  }

  async getConflictingRecords(): Promise<{
    lists: OfflineList[]
    items: OfflineItem[]
    shares: OfflineShare[]
  }> {
    const [lists, items, shares] = await Promise.all([
      this.lists.where('_syncStatus').equals('conflict').toArray(),
      this.items.where('_syncStatus').equals('conflict').toArray(),
      this.shares.where('_syncStatus').equals('conflict').toArray()
    ])

    return { lists, items, shares }
  }

  async getPendingRecords(): Promise<{
    lists: OfflineList[]
    items: OfflineItem[]
    shares: OfflineShare[]
  }> {
    const [lists, items, shares] = await Promise.all([
      this.lists.where('_syncStatus').equals('pending').toArray(),
      this.items.where('_syncStatus').equals('pending').toArray(),
      this.shares.where('_syncStatus').equals('pending').toArray()
    ])

    return { lists, items, shares }
  }
}

export const offlineDb = new OfflineDatabase()