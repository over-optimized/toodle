import Dexie, { Table } from 'dexie'
import type { List, Item, Share, User } from '../types'

export interface OfflineList extends List {
  _syncStatus: 'synced' | 'pending' | 'conflict' | 'deleted'
  _lastModified: number
  _dirty?: boolean
}

export interface OfflineItem extends Item {
  _syncStatus: 'synced' | 'pending' | 'conflict' | 'deleted'
  _lastModified: number
  _dirty?: boolean
}

export interface OfflineShare extends Share {
  _syncStatus: 'synced' | 'pending' | 'conflict' | 'deleted'
  _lastModified: number
  _dirty?: boolean
}

export interface OfflineUser extends User {
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
  users!: Table<OfflineUser>
  pendingOperations!: Table<PendingOperation>

  constructor() {
    super('ToodleOfflineDB')

    this.version(3).stores({
      lists: 'id, user_id, type, title, is_private, _syncStatus, _lastModified, _dirty, created_at, updated_at',
      items: 'id, list_id, content, is_completed, completed_at, target_date, position, _syncStatus, _lastModified, _dirty, created_at, updated_at',
      shares: 'id, list_id, shared_with_user_id, permission, created_by_user_id, expires_at, _syncStatus, _lastModified, _dirty, created_at',
      users: 'id, email, display_name, avatar_url, _syncStatus, _lastModified, created_at, updated_at',
      pendingOperations: '++id, type, table, recordId, timestamp, retryCount, lastError'
    })
  }

  async saveList(list: List, markDirty = true): Promise<OfflineList> {
    const offlineList: OfflineList = {
      ...list,
      _syncStatus: markDirty ? 'pending' : 'synced',
      _lastModified: Date.now(),
      _dirty: markDirty
    }

    await this.lists.put(offlineList)

    if (markDirty) {
      await this.queueOperation({
        type: 'update',
        table: 'lists',
        recordId: list.id,
        data: list
      })
    }

    return offlineList
  }

  async saveItem(item: Item, markDirty = true): Promise<OfflineItem> {
    const offlineItem: OfflineItem = {
      ...item,
      _syncStatus: markDirty ? 'pending' : 'synced',
      _lastModified: Date.now(),
      _dirty: markDirty
    }

    await this.items.put(offlineItem)

    if (markDirty) {
      await this.queueOperation({
        type: 'update',
        table: 'items',
        recordId: item.id,
        data: item
      })
    }

    return offlineItem
  }

  async saveShare(share: Share, markDirty = true): Promise<OfflineShare> {
    const offlineShare: OfflineShare = {
      ...share,
      _syncStatus: markDirty ? 'pending' : 'synced',
      _lastModified: Date.now(),
      _dirty: markDirty
    }

    await this.shares.put(offlineShare)

    if (markDirty) {
      await this.queueOperation({
        type: 'update',
        table: 'shares',
        recordId: share.id,
        data: share
      })
    }

    return offlineShare
  }

  async saveUser(user: User): Promise<OfflineUser> {
    const offlineUser: OfflineUser = {
      ...user,
      _syncStatus: 'synced',
      _lastModified: Date.now()
    }

    await this.users.put(offlineUser)
    return offlineUser
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
    return this.lists
      .where('user_id')
      .equals(userId)
      .and(list => list._syncStatus !== 'deleted')
      .toArray()
  }

  async getListItems(listId: string): Promise<OfflineItem[]> {
    return this.items
      .where('list_id')
      .equals(listId)
      .and(item => item._syncStatus !== 'deleted')
      .sortBy('position')
  }

  async getListShares(listId: string): Promise<OfflineShare[]> {
    return this.shares
      .where('list_id')
      .equals(listId)
      .and(share => share._syncStatus !== 'deleted')
      .toArray()
  }

  async deleteList(listId: string): Promise<void> {
    await this.lists.update(listId, {
      _syncStatus: 'deleted',
      _lastModified: Date.now(),
      _dirty: true
    })

    await this.queueOperation({
      type: 'delete',
      table: 'lists',
      recordId: listId
    })
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.items.update(itemId, {
      _syncStatus: 'deleted',
      _lastModified: Date.now(),
      _dirty: true
    })

    await this.queueOperation({
      type: 'delete',
      table: 'items',
      recordId: itemId
    })
  }

  async deleteShare(shareId: string): Promise<void> {
    await this.shares.update(shareId, {
      _syncStatus: 'deleted',
      _lastModified: Date.now(),
      _dirty: true
    })

    await this.queueOperation({
      type: 'delete',
      table: 'shares',
      recordId: shareId
    })
  }

  async createList(list: List): Promise<OfflineList> {
    const offlineList: OfflineList = {
      ...list,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _dirty: true
    }

    await this.lists.put(offlineList)
    await this.queueOperation({
      type: 'create',
      table: 'lists',
      recordId: list.id,
      data: list
    })

    return offlineList
  }

  async createItem(item: Item): Promise<OfflineItem> {
    const offlineItem: OfflineItem = {
      ...item,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _dirty: true
    }

    await this.items.put(offlineItem)
    await this.queueOperation({
      type: 'create',
      table: 'items',
      recordId: item.id,
      data: item
    })

    return offlineItem
  }

  async createShare(share: Share): Promise<OfflineShare> {
    const offlineShare: OfflineShare = {
      ...share,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _dirty: true
    }

    await this.shares.put(offlineShare)
    await this.queueOperation({
      type: 'create',
      table: 'shares',
      recordId: share.id,
      data: share
    })

    return offlineShare
  }

  async clearUserData(userId: string): Promise<void> {
    await this.transaction('rw', this.lists, this.items, this.shares, this.users, this.pendingOperations, async () => {
      await this.lists.where('user_id').equals(userId).delete()
      const userLists = await this.lists.where('user_id').equals(userId).toArray()
      const listIds = userLists.map(list => list.id)

      for (const listId of listIds) {
        await this.items.where('list_id').equals(listId).delete()
        await this.shares.where('list_id').equals(listId).delete()
      }

      await this.users.where('id').equals(userId).delete()
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

  async getStorageStats(): Promise<{
    totalRecords: number
    pendingSync: number
    conflicts: number
    storageSize: string
  }> {
    const [listsCount, itemsCount, sharesCount, usersCount, pendingCount, conflictingRecords] = await Promise.all([
      this.lists.count(),
      this.items.count(),
      this.shares.count(),
      this.users.count(),
      this.pendingOperations.count(),
      this.getConflictingRecords()
    ])

    const conflictCount = conflictingRecords.lists.length + conflictingRecords.items.length + conflictingRecords.shares.length

    return {
      totalRecords: listsCount + itemsCount + sharesCount + usersCount,
      pendingSync: pendingCount,
      conflicts: conflictCount,
      storageSize: 'Unknown' // IndexedDB doesn't provide easy size calculation
    }
  }

  async initializeDatabase(): Promise<void> {
    try {
      await this.open()
      console.log('Offline database initialized successfully')
    } catch (error) {
      console.error('Failed to initialize offline database:', error)
      throw error
    }
  }

  async resetDatabase(): Promise<void> {
    await this.transaction('rw', this.lists, this.items, this.shares, this.users, this.pendingOperations, async () => {
      await Promise.all([
        this.lists.clear(),
        this.items.clear(),
        this.shares.clear(),
        this.users.clear(),
        this.pendingOperations.clear()
      ])
    })
  }

  async getSyncableRecords(): Promise<{
    lists: OfflineList[]
    items: OfflineItem[]
    shares: OfflineShare[]
  }> {
    const [lists, items, shares] = await Promise.all([
      this.lists.where('_dirty').equals(true).toArray(),
      this.items.where('_dirty').equals(true).toArray(),
      this.shares.where('_dirty').equals(true).toArray()
    ])

    return { lists, items, shares }
  }

  async markRecordSynced(table: 'lists' | 'items' | 'shares', recordId: string): Promise<void> {
    const tableRef = this[table] as Table<OfflineList | OfflineItem | OfflineShare>
    await tableRef.update(recordId, {
      _syncStatus: 'synced',
      _dirty: false,
      _lastModified: Date.now()
    })
  }

  async removeDeletedRecord(table: 'lists' | 'items' | 'shares', recordId: string): Promise<void> {
    const tableRef = this[table] as Table<OfflineList | OfflineItem | OfflineShare>
    await tableRef.delete(recordId)
  }
}

export const offlineDb = new OfflineDatabase()

export const initializeOfflineDatabase = async (): Promise<void> => {
  await offlineDb.initializeDatabase()
}