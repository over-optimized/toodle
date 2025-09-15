import { List, Item } from './database'

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error'
export type OfflineAction = 'create' | 'update' | 'delete'

export interface OfflineChange {
  id: string
  table: 'lists' | 'items' | 'shares'
  action: OfflineAction
  entityId: string
  data: unknown
  timestamp: number
  synced: boolean
}

export interface OfflineList extends List {
  syncStatus: SyncStatus
  lastSynced?: number
}

export interface OfflineItem extends Item {
  syncStatus: SyncStatus
  lastSynced?: number
  tempId?: string
}

export interface SyncConflict {
  id: string
  table: string
  entityId: string
  localData: unknown
  remoteData: unknown
  timestamp: number
}

export interface ConnectionStatus {
  isOnline: boolean
  lastOnline?: number
  syncInProgress: boolean
}