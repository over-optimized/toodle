import { offlineDb, type OfflineList, type OfflineItem, type OfflineShare } from '../lib/offline-db'
import { listService } from './list.service'
import { itemService } from './item.service'
import { shareService } from './share.service'
import type { List, Item, Share } from '../types'

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge' | 'manual'
  resolvedData?: any
}

export interface SyncConflict {
  type: 'list' | 'item' | 'share'
  localRecord: OfflineList | OfflineItem | OfflineShare
  remoteRecord: List | Item | Share | null
  conflictReason: 'both_modified' | 'deleted_remotely' | 'created_locally'
}

export class SyncService {
  private conflictResolver: Map<string, (conflict: SyncConflict) => Promise<ConflictResolution>> = new Map()

  constructor() {
    this.setupDefaultResolvers()
  }

  private setupDefaultResolvers(): void {
    // Default resolver: prefer remote data for most conflicts
    this.conflictResolver.set('default', async (conflict: SyncConflict): Promise<ConflictResolution> => {
      switch (conflict.conflictReason) {
        case 'both_modified':
          return { strategy: 'remote' } // Remote wins by default
        case 'deleted_remotely':
          return { strategy: 'remote' } // Accept deletion
        case 'created_locally':
          return { strategy: 'local' } // Keep local creation
        default:
          return { strategy: 'manual' }
      }
    })

    // List-specific resolver
    this.conflictResolver.set('list', async (conflict: SyncConflict): Promise<ConflictResolution> => {
      const local = conflict.localRecord as OfflineList
      const remote = conflict.remoteRecord as List

      if (conflict.conflictReason === 'both_modified' && remote) {
        // Merge strategy: keep local title if changed, remote everything else
        const merged = {
          ...remote,
          title: local.title !== remote.title ? local.title : remote.title
        }
        return { strategy: 'merge', resolvedData: merged }
      }

      return this.conflictResolver.get('default')!(conflict)
    })

    // Item-specific resolver
    this.conflictResolver.set('item', async (conflict: SyncConflict): Promise<ConflictResolution> => {
      const local = conflict.localRecord as OfflineItem
      const remote = conflict.remoteRecord as Item

      if (conflict.conflictReason === 'both_modified' && remote) {
        // Merge strategy: prefer completion status from most recent
        const localModified = local._lastModified
        const remoteModified = new Date(remote.updated_at).getTime()

        if (local.is_completed !== remote.is_completed) {
          if (localModified > remoteModified) {
            const merged = {
              ...remote,
              is_completed: local.is_completed,
              completed_at: local.completed_at
            }
            return { strategy: 'merge', resolvedData: merged }
          }
        }
      }

      return this.conflictResolver.get('default')!(conflict)
    })
  }

  async detectConflicts(): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = []

    try {
      // Get all pending records
      const pending = await offlineDb.getPendingRecords()

      // Check each pending record against remote
      for (const localList of pending.lists) {
        const conflict = await this.checkListConflict(localList)
        if (conflict) conflicts.push(conflict)
      }

      for (const localItem of pending.items) {
        const conflict = await this.checkItemConflict(localItem)
        if (conflict) conflicts.push(conflict)
      }

      for (const localShare of pending.shares) {
        const conflict = await this.checkShareConflict(localShare)
        if (conflict) conflicts.push(conflict)
      }

      return conflicts
    } catch (error) {
      console.error('Failed to detect conflicts:', error)
      return []
    }
  }

  private async checkListConflict(local: OfflineList): Promise<SyncConflict | null> {
    try {
      if (local.id.startsWith('temp_')) {
        // Temporary ID, check if similar list exists
        return null // Handle in normal sync flow
      }

      const { data: remote } = await listService.getList(local.id)

      if (!remote) {
        return {
          type: 'list',
          localRecord: local,
          remoteRecord: null,
          conflictReason: 'deleted_remotely'
        }
      }

      const remoteModified = new Date(remote.updated_at).getTime()
      const localModified = local._lastModified

      if (remoteModified > localModified) {
        return {
          type: 'list',
          localRecord: local,
          remoteRecord: remote,
          conflictReason: 'both_modified'
        }
      }

      return null
    } catch (error) {
      console.error('Failed to check list conflict:', error)
      return null
    }
  }

  private async checkItemConflict(local: OfflineItem): Promise<SyncConflict | null> {
    try {
      if (local.id.startsWith('temp_')) {
        return null // Handle in normal sync flow
      }

      const { data: remote } = await itemService.getItem(local.id)

      if (!remote) {
        return {
          type: 'item',
          localRecord: local,
          remoteRecord: null,
          conflictReason: 'deleted_remotely'
        }
      }

      const remoteModified = new Date(remote.updated_at).getTime()
      const localModified = local._lastModified

      if (remoteModified > localModified) {
        return {
          type: 'item',
          localRecord: local,
          remoteRecord: remote,
          conflictReason: 'both_modified'
        }
      }

      return null
    } catch (error) {
      console.error('Failed to check item conflict:', error)
      return null
    }
  }

  private async checkShareConflict(local: OfflineShare): Promise<SyncConflict | null> {
    try {
      if (local.id.startsWith('temp_')) {
        return null // Handle in normal sync flow
      }

      const { data: shares } = await shareService.getShares(local.list_id)
      const remote = shares?.find(s => s.id === local.id)

      if (!remote) {
        return {
          type: 'share',
          localRecord: local,
          remoteRecord: null,
          conflictReason: 'deleted_remotely'
        }
      }

      const remoteModified = new Date(remote.created_at).getTime()
      const localModified = local._lastModified

      if (remoteModified > localModified) {
        return {
          type: 'share',
          localRecord: local,
          remoteRecord: remote,
          conflictReason: 'both_modified'
        }
      }

      return null
    } catch (error) {
      console.error('Failed to check share conflict:', error)
      return null
    }
  }

  async resolveConflicts(conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      try {
        const resolver = this.conflictResolver.get(conflict.type) || this.conflictResolver.get('default')!
        const resolution = await resolver(conflict)

        await this.applyResolution(conflict, resolution)
      } catch (error) {
        console.error('Failed to resolve conflict:', conflict, error)
        await this.markConflictForManualResolution(conflict)
      }
    }
  }

  private async applyResolution(conflict: SyncConflict, resolution: ConflictResolution): Promise<void> {
    const { strategy, resolvedData } = resolution

    switch (strategy) {
      case 'local':
        await this.keepLocalData(conflict)
        break
      case 'remote':
        await this.useRemoteData(conflict)
        break
      case 'merge':
        await this.applyMergedData(conflict, resolvedData)
        break
      case 'manual':
        await this.markConflictForManualResolution(conflict)
        break
    }
  }

  private async keepLocalData(conflict: SyncConflict): Promise<void> {
    // Mark local data as synced and continue with pending operations
    const recordId = conflict.localRecord.id

    switch (conflict.type) {
      case 'list':
        await offlineDb.markSynced('lists', recordId)
        break
      case 'item':
        await offlineDb.markSynced('items', recordId)
        break
      case 'share':
        await offlineDb.markSynced('shares', recordId)
        break
    }
  }

  private async useRemoteData(conflict: SyncConflict): Promise<void> {
    const recordId = conflict.localRecord.id

    if (conflict.remoteRecord) {
      // Update local data with remote data
      switch (conflict.type) {
        case 'list':
          await offlineDb.saveList(conflict.remoteRecord as List)
          await offlineDb.markSynced('lists', recordId)
          break
        case 'item':
          await offlineDb.saveItem(conflict.remoteRecord as Item)
          await offlineDb.markSynced('items', recordId)
          break
        case 'share':
          await offlineDb.saveShare(conflict.remoteRecord as Share)
          await offlineDb.markSynced('shares', recordId)
          break
      }
    } else {
      // Remote was deleted, remove local data
      switch (conflict.type) {
        case 'list':
          await offlineDb.lists.delete(recordId)
          break
        case 'item':
          await offlineDb.items.delete(recordId)
          break
        case 'share':
          await offlineDb.shares.delete(recordId)
          break
      }
    }
  }

  private async applyMergedData(conflict: SyncConflict, mergedData: any): Promise<void> {
    const recordId = conflict.localRecord.id

    switch (conflict.type) {
      case 'list':
        await offlineDb.saveList(mergedData as List)
        await offlineDb.markSynced('lists', recordId)
        break
      case 'item':
        await offlineDb.saveItem(mergedData as Item)
        await offlineDb.markSynced('items', recordId)
        break
      case 'share':
        await offlineDb.saveShare(mergedData as Share)
        await offlineDb.markSynced('shares', recordId)
        break
    }
  }

  private async markConflictForManualResolution(conflict: SyncConflict): Promise<void> {
    const recordId = conflict.localRecord.id

    switch (conflict.type) {
      case 'list':
        await offlineDb.markConflict('lists', recordId)
        break
      case 'item':
        await offlineDb.markConflict('items', recordId)
        break
      case 'share':
        await offlineDb.markConflict('shares', recordId)
        break
    }

    // Emit event for UI to handle manual resolution
    window.dispatchEvent(new CustomEvent('sync-conflict', {
      detail: { conflict }
    }))
  }

  setConflictResolver(type: string, resolver: (conflict: SyncConflict) => Promise<ConflictResolution>): void {
    this.conflictResolver.set(type, resolver)
  }

  async getConflictingRecords(): Promise<{
    lists: OfflineList[]
    items: OfflineItem[]
    shares: OfflineShare[]
  }> {
    return offlineDb.getConflictingRecords()
  }

  async resolveManualConflict(
    type: 'list' | 'item' | 'share',
    recordId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    const record = await this.getConflictingRecord(type, recordId)
    if (!record) {
      throw new Error(`Conflicting ${type} not found: ${recordId}`)
    }

    const conflict: SyncConflict = {
      type,
      localRecord: record,
      remoteRecord: null, // Will be fetched if needed
      conflictReason: 'both_modified'
    }

    await this.applyResolution(conflict, resolution)
  }

  private async getConflictingRecord(
    type: 'list' | 'item' | 'share',
    recordId: string
  ): Promise<OfflineList | OfflineItem | OfflineShare | null> {
    switch (type) {
      case 'list':
        return offlineDb.lists.get(recordId) || null
      case 'item':
        return offlineDb.items.get(recordId) || null
      case 'share':
        return offlineDb.shares.get(recordId) || null
      default:
        return null
    }
  }

  async performFullSync(): Promise<void> {
    try {
      // 1. Detect conflicts
      const conflicts = await this.detectConflicts()

      // 2. Resolve conflicts
      if (conflicts.length > 0) {
        await this.resolveConflicts(conflicts)
      }

      // 3. Sync remaining pending operations
      const { offlineService } = await import('./offline.service')
      await offlineService.syncPendingOperations()

      // 4. Emit sync complete event
      window.dispatchEvent(new CustomEvent('full-sync-complete', {
        detail: {
          conflictsResolved: conflicts.length,
          success: true
        }
      }))
    } catch (error) {
      console.error('Full sync failed:', error)
      window.dispatchEvent(new CustomEvent('full-sync-complete', {
        detail: {
          conflictsResolved: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  }
}

export const syncService = new SyncService()