// T029: Integration Test - Offline Functionality and Sync
// CRITICAL: This test MUST FAIL before implementation
// Tests offline capabilities with IndexedDB and sync when back online

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key'

// Mock IndexedDB for testing offline functionality
// In a real implementation, this would use Dexie.js
class MockIndexedDB {
  private data: Map<string, any> = new Map()

  async get(key: string) {
    return this.data.get(key)
  }

  async set(key: string, value: any) {
    this.data.set(key, value)
  }

  async delete(key: string) {
    this.data.delete(key)
  }

  async keys() {
    return Array.from(this.data.keys())
  }

  async clear() {
    this.data.clear()
  }
}

describe('Offline Functionality and Sync Integration', () => {
  let supabase: ReturnType<typeof createClient>
  let authToken: string
  let userId: string
  let mockIDB: MockIndexedDB
  let isOnline: boolean

  beforeEach(async () => {
    supabase = createClient(supabaseUrl, supabaseKey)
    mockIDB = new MockIndexedDB()
    isOnline = true

    const testEmail = `offline-${Date.now()}@example.com`
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: true
      }
    })

    if (authError || !authData.user) {
      throw new Error('Failed to create test user for offline integration test')
    }

    authToken = authData.session?.access_token || ''
    userId = authData.user.id
  })

  // Helper function to simulate offline/online state
  const setNetworkState = (online: boolean) => {
    isOnline = online
  }

  // Helper function to make API request with offline simulation
  const makeRequest = async (url: string, options: RequestInit) => {
    if (!isOnline) {
      throw new Error('Network request failed - offline')
    }
    return fetch(url, options)
  }

  describe('Offline Data Storage and Retrieval', () => {
    it('should store list data locally when offline', async () => {
      // Step 1: Create list and items while online
      const listResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'grocery',
          title: 'Offline Test List'
        })
      })

      expect(listResponse.status).toBe(201)
      const createdList = await listResponse.json()
      const list = Array.isArray(createdList) ? createdList[0] : createdList
      const listId = list.id

      const itemsToAdd = [
        { content: 'Apples', sort_order: 1 },
        { content: 'Bananas', sort_order: 2 },
        { content: 'Milk', sort_order: 3 }
      ]

      const createdItems = []
      for (const item of itemsToAdd) {
        const itemResponse = await makeRequest(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            list_id: listId,
            ...item
          })
        })

        const createdItem = await itemResponse.json()
        const itemData = Array.isArray(createdItem) ? createdItem[0] : createdItem
        createdItems.push(itemData)
      }

      // Step 2: Store data locally (simulate app caching data)
      await mockIDB.set(`list:${listId}`, list)
      await mockIDB.set(`list:${listId}:items`, createdItems)

      // Step 3: Go offline
      setNetworkState(false)

      // Step 4: Verify local data can be retrieved
      const cachedList = await mockIDB.get(`list:${listId}`)
      const cachedItems = await mockIDB.get(`list:${listId}:items`)

      expect(cachedList).toBeDefined()
      expect(cachedList.id).toBe(listId)
      expect(cachedList.title).toBe('Offline Test List')
      expect(cachedItems).toHaveLength(3)
      expect(cachedItems[0].content).toBe('Apples')

      // Step 5: Make offline modifications
      const offlineChanges = []

      // Add new item offline
      const newOfflineItem = {
        id: `temp-${Date.now()}`,
        list_id: listId,
        content: 'Offline item',
        is_completed: false,
        sort_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pendingSync: true
      }

      cachedItems.push(newOfflineItem)
      await mockIDB.set(`list:${listId}:items`, cachedItems)

      offlineChanges.push({
        type: 'create',
        table: 'items',
        data: newOfflineItem
      })

      // Complete existing item offline
      cachedItems[0].is_completed = true
      cachedItems[0].updated_at = new Date().toISOString()
      cachedItems[0]._pendingSync = true

      await mockIDB.set(`list:${listId}:items`, cachedItems)

      offlineChanges.push({
        type: 'update',
        table: 'items',
        id: cachedItems[0].id,
        data: { is_completed: true }
      })

      // Store offline changes queue
      await mockIDB.set('pendingChanges', offlineChanges)

      // Step 6: Verify offline state
      const updatedCachedItems = await mockIDB.get(`list:${listId}:items`)
      expect(updatedCachedItems).toHaveLength(4) // 3 original + 1 new
      expect(updatedCachedItems[0].is_completed).toBe(true)
      expect(updatedCachedItems[3].content).toBe('Offline item')

      const pendingChanges = await mockIDB.get('pendingChanges')
      expect(pendingChanges).toHaveLength(2)
    })

    it('should handle offline list creation and modifications', async () => {
      // Start offline
      setNetworkState(false)

      // Create list offline
      const offlineListId = `temp-list-${Date.now()}`
      const offlineList = {
        id: offlineListId,
        user_id: userId,
        type: 'simple',
        title: 'Offline Created List',
        is_private: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pendingSync: true
      }

      await mockIDB.set(`list:${offlineListId}`, offlineList)

      // Add items to offline list
      const offlineItems = [
        {
          id: `temp-item-1-${Date.now()}`,
          list_id: offlineListId,
          content: 'Offline task 1',
          is_completed: false,
          sort_order: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _pendingSync: true
        },
        {
          id: `temp-item-2-${Date.now()}`,
          list_id: offlineListId,
          content: 'Offline task 2',
          is_completed: false,
          sort_order: 2,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          _pendingSync: true
        }
      ]

      await mockIDB.set(`list:${offlineListId}:items`, offlineItems)

      // Queue offline changes
      const offlineChanges = [
        {
          type: 'create',
          table: 'lists',
          tempId: offlineListId,
          data: offlineList
        },
        ...offlineItems.map(item => ({
          type: 'create',
          table: 'items',
          tempId: item.id,
          data: item
        }))
      ]

      await mockIDB.set('pendingChanges', offlineChanges)

      // Verify offline state
      const cachedList = await mockIDB.get(`list:${offlineListId}`)
      const cachedItems = await mockIDB.get(`list:${offlineListId}:items`)
      const pendingChanges = await mockIDB.get('pendingChanges')

      expect(cachedList.title).toBe('Offline Created List')
      expect(cachedItems).toHaveLength(2)
      expect(pendingChanges).toHaveLength(3) // 1 list + 2 items

      // Modify offline items
      cachedItems[0].is_completed = true
      cachedItems[0].updated_at = new Date().toISOString()
      await mockIDB.set(`list:${offlineListId}:items`, cachedItems)

      // Add update to pending changes
      pendingChanges.push({
        type: 'update',
        table: 'items',
        tempId: cachedItems[0].id,
        data: { is_completed: true }
      })

      await mockIDB.set('pendingChanges', pendingChanges)

      expect(pendingChanges).toHaveLength(4)
    })
  })

  describe('Sync When Back Online', () => {
    it('should sync offline changes when connection is restored', async () => {
      // Step 1: Create initial data online
      const onlineListResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Sync Test List'
        })
      })

      const onlineList = await onlineListResponse.json()
      const listData = Array.isArray(onlineList) ? onlineList[0] : onlineList
      const listId = listData.id

      // Step 2: Go offline and make changes
      setNetworkState(false)

      const offlineChanges = []

      // Add item offline
      const offlineItemId = `temp-${Date.now()}`
      const offlineItem = {
        id: offlineItemId,
        list_id: listId,
        content: 'Added offline',
        is_completed: false,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pendingSync: true
      }

      offlineChanges.push({
        type: 'create',
        table: 'items',
        tempId: offlineItemId,
        data: offlineItem
      })

      // Update list title offline
      listData.title = 'Updated Offline'
      listData.updated_at = new Date().toISOString()
      listData._pendingSync = true

      offlineChanges.push({
        type: 'update',
        table: 'lists',
        id: listId,
        data: { title: 'Updated Offline' }
      })

      await mockIDB.set('pendingChanges', offlineChanges)
      await mockIDB.set(`list:${listId}`, listData)

      // Step 3: Come back online and sync
      setNetworkState(true)

      const pendingChanges = await mockIDB.get('pendingChanges') || []
      const syncResults = []

      for (const change of pendingChanges) {
        try {
          if (change.type === 'create' && change.table === 'items') {
            // Create item on server
            const { tempId, data } = change
            const { _pendingSync, id, ...serverData } = data

            const createResponse = await makeRequest(`${supabaseUrl}/rest/v1/items`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(serverData)
            })

            if (createResponse.status === 201) {
              const serverItem = await createResponse.json()
              const itemData = Array.isArray(serverItem) ? serverItem[0] : serverItem

              syncResults.push({
                success: true,
                tempId,
                serverId: itemData.id,
                type: 'create'
              })
            }
          } else if (change.type === 'update' && change.table === 'lists') {
            // Update list on server
            const updateResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists?id=eq.${change.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'apikey': supabaseKey
              },
              body: JSON.stringify(change.data)
            })

            if (updateResponse.status === 200) {
              syncResults.push({
                success: true,
                id: change.id,
                type: 'update'
              })
            }
          }
        } catch (error) {
          syncResults.push({
            success: false,
            error: error.message,
            change
          })
        }
      }

      // Step 4: Verify sync results
      const successfulSyncs = syncResults.filter(r => r.success)
      expect(successfulSyncs).toHaveLength(2)

      // Verify server state matches offline changes
      const verifyListResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists/${listId}?select=*,items(*)`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const verifyList = await verifyListResponse.json()
      expect(verifyList.title).toBe('Updated Offline')
      expect(verifyList.items).toHaveLength(1)
      expect(verifyList.items[0].content).toBe('Added offline')

      // Step 5: Clear successfully synced changes
      await mockIDB.delete('pendingChanges')

      // Update local data with server IDs
      const serverItemId = verifyList.items[0].id
      await mockIDB.set(`item:${serverItemId}`, {
        ...offlineItem,
        id: serverItemId,
        _pendingSync: false
      })
    })

    it('should handle sync conflicts and resolution', async () => {
      // Step 1: Create list online
      const listResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Conflict Test List'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Add item online
      const itemResponse = await makeRequest(`${supabaseUrl}/rest/v1/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          list_id: listId,
          content: 'Conflicting item',
          sort_order: 1
        })
      })

      const item = await itemResponse.json()
      const itemData = Array.isArray(item) ? item[0] : item
      const itemId = itemData.id

      // Cache locally
      await mockIDB.set(`list:${listId}`, listData)
      await mockIDB.set(`item:${itemId}`, itemData)

      // Step 2: Make conflicting changes
      // Online change (simulated by another user/device)
      const onlineUpdateResponse = await makeRequest(`${supabaseUrl}/rest/v1/items?id=eq.${itemId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({
          content: 'Updated online'
        })
      })

      expect(onlineUpdateResponse.status).toBe(200)

      // Offline change (this user)
      setNetworkState(false)

      const cachedItem = await mockIDB.get(`item:${itemId}`)
      cachedItem.content = 'Updated offline'
      cachedItem.updated_at = new Date().toISOString()
      cachedItem._pendingSync = true

      await mockIDB.set(`item:${itemId}`, cachedItem)
      await mockIDB.set('pendingChanges', [{
        type: 'update',
        table: 'items',
        id: itemId,
        data: { content: 'Updated offline' }
      }])

      // Step 3: Come online and detect conflict
      setNetworkState(true)

      // Fetch current server state
      const serverStateResponse = await makeRequest(`${supabaseUrl}/rest/v1/items?id=eq.${itemId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      })

      const serverState = await serverStateResponse.json()
      const serverItem = serverState[0]

      // Detect conflict (server updated_at is different from cached)
      const cachedItemForConflict = await mockIDB.get(`item:${itemId}`)
      const hasConflict = serverItem.updated_at !== cachedItemForConflict.updated_at

      expect(hasConflict).toBe(true)
      expect(serverItem.content).toBe('Updated online')
      expect(cachedItemForConflict.content).toBe('Updated offline')

      // Step 4: Resolve conflict (last-write-wins strategy)
      const conflictResolution = {
        strategy: 'server-wins', // Could be 'client-wins' or 'merge'
        resolvedContent: serverItem.content,
        conflictTimestamp: new Date().toISOString()
      }

      // Update local cache with server version
      await mockIDB.set(`item:${itemId}`, {
        ...serverItem,
        _conflictResolved: true,
        _conflictResolution: conflictResolution
      })

      // Remove pending change since conflict was resolved
      await mockIDB.delete('pendingChanges')

      // Verify conflict resolution
      const resolvedItem = await mockIDB.get(`item:${itemId}`)
      expect(resolvedItem.content).toBe('Updated online')
      expect(resolvedItem._conflictResolved).toBe(true)
    })
  })

  describe('Optimistic Updates and Rollback', () => {
    it('should handle optimistic updates with rollback on failure', async () => {
      // Step 1: Create list online
      const listResponse = await makeRequest(`${supabaseUrl}/rest/v1/lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type: 'simple',
          title: 'Optimistic Update Test'
        })
      })

      const list = await listResponse.json()
      const listData = Array.isArray(list) ? list[0] : list
      const listId = listData.id

      // Cache locally
      await mockIDB.set(`list:${listId}`, listData)

      // Step 2: Perform optimistic update
      const optimisticUpdate = {
        id: `optimistic-${Date.now()}`,
        list_id: listId,
        content: 'Optimistic item',
        is_completed: false,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _optimistic: true
      }

      // Apply optimistic update locally first
      const cachedItems = await mockIDB.get(`list:${listId}:items`) || []
      cachedItems.push(optimisticUpdate)
      await mockIDB.set(`list:${listId}:items`, cachedItems)

      // Verify optimistic state
      const optimisticItems = await mockIDB.get(`list:${listId}:items`)
      expect(optimisticItems).toHaveLength(1)
      expect(optimisticItems[0].content).toBe('Optimistic item')
      expect(optimisticItems[0]._optimistic).toBe(true)

      // Step 3: Attempt server update (simulate failure)
      try {
        // Simulate server error by using invalid data
        const serverResponse = await makeRequest(`${supabaseUrl}/rest/v1/items`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            list_id: 'invalid-list-id', // This will cause an error
            content: 'Optimistic item',
            sort_order: 1
          })
        })

        // If request succeeds, remove optimistic flag
        if (serverResponse.status === 201) {
          const serverItem = await serverResponse.json()
          const itemData = Array.isArray(serverItem) ? serverItem[0] : serverItem

          // Replace optimistic item with server response
          const updatedItems = cachedItems.map(item =>
            item.id === optimisticUpdate.id
              ? { ...itemData, _optimistic: false }
              : item
          )
          await mockIDB.set(`list:${listId}:items`, updatedItems)
        }
      } catch (error) {
        // Step 4: Rollback optimistic update on failure
        const rolledBackItems = cachedItems.filter(item => item.id !== optimisticUpdate.id)
        await mockIDB.set(`list:${listId}:items`, rolledBackItems)

        // Store failed operation for retry
        await mockIDB.set('failedOperations', [{
          operation: 'create',
          table: 'items',
          data: optimisticUpdate,
          error: error.message,
          timestamp: new Date().toISOString()
        }])
      }

      // Verify rollback
      const finalItems = await mockIDB.get(`list:${listId}:items`)
      expect(finalItems).toHaveLength(0) // Optimistic item should be removed

      const failedOps = await mockIDB.get('failedOperations')
      expect(failedOps).toHaveLength(1)
      expect(failedOps[0].operation).toBe('create')
    })
  })

  describe('Offline State Management', () => {
    it('should manage offline state indicators', async () => {
      // Step 1: Track online state
      let offlineIndicator = false

      // Go offline
      setNetworkState(false)
      offlineIndicator = true

      expect(isOnline).toBe(false)
      expect(offlineIndicator).toBe(true)

      // Step 2: Queue operations while offline
      const offlineOperations = []

      // Simulate user actions while offline
      offlineOperations.push({
        type: 'create',
        table: 'lists',
        tempId: `temp-list-${Date.now()}`,
        data: {
          type: 'simple',
          title: 'Offline List',
          user_id: userId
        }
      })

      offlineOperations.push({
        type: 'update',
        table: 'user_preferences',
        data: {
          offline_mode: true,
          last_sync: new Date().toISOString()
        }
      })

      await mockIDB.set('offlineOperations', offlineOperations)
      await mockIDB.set('offlineState', {
        isOffline: true,
        since: new Date().toISOString(),
        pendingOperations: offlineOperations.length
      })

      // Verify offline state
      const offlineState = await mockIDB.get('offlineState')
      expect(offlineState.isOffline).toBe(true)
      expect(offlineState.pendingOperations).toBe(2)

      // Step 3: Return online
      setNetworkState(true)
      offlineIndicator = false

      // Update offline state
      await mockIDB.set('offlineState', {
        isOffline: false,
        lastOnline: new Date().toISOString(),
        pendingOperations: 0
      })

      const onlineState = await mockIDB.get('offlineState')
      expect(onlineState.isOffline).toBe(false)
      expect(isOnline).toBe(true)
    })

    it('should handle partial sync scenarios', async () => {
      // Create multiple pending operations
      const pendingOps = [
        {
          id: 'op1',
          type: 'create',
          table: 'lists',
          data: { title: 'List 1', type: 'simple', user_id: userId }
        },
        {
          id: 'op2',
          type: 'create',
          table: 'lists',
          data: { title: 'List 2', type: 'grocery', user_id: userId }
        },
        {
          id: 'op3',
          type: 'create',
          table: 'lists',
          data: { title: 'List 3', type: 'countdown', user_id: userId }
        }
      ]

      await mockIDB.set('pendingOps', pendingOps)

      // Simulate partial sync (some operations succeed, others fail)
      const syncResults = []

      for (const op of pendingOps) {
        try {
          if (op.id === 'op2') {
            // Simulate failure for second operation
            throw new Error('Server temporarily unavailable')
          }

          const response = await makeRequest(`${supabaseUrl}/rest/v1/lists`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'apikey': supabaseKey
            },
            body: JSON.stringify(op.data)
          })

          if (response.status === 201) {
            syncResults.push({ id: op.id, success: true })
          }
        } catch (error) {
          syncResults.push({ id: op.id, success: false, error: error.message })
        }
      }

      // Verify partial sync results
      const successfulOps = syncResults.filter(r => r.success)
      const failedOps = syncResults.filter(r => !r.success)

      expect(successfulOps).toHaveLength(2)
      expect(failedOps).toHaveLength(1)
      expect(failedOps[0].id).toBe('op2')

      // Keep failed operations for retry
      const remainingOps = pendingOps.filter(op =>
        failedOps.some(failed => failed.id === op.id)
      )

      await mockIDB.set('pendingOps', remainingOps)

      const retryOps = await mockIDB.get('pendingOps')
      expect(retryOps).toHaveLength(1)
      expect(retryOps[0].id).toBe('op2')
    })
  })

  describe('Performance and Storage Management', () => {
    it('should handle offline storage limitations', async () => {
      // Simulate storage quota management
      const maxStorageItems = 1000
      let currentStorageItems = 0

      // Create many lists and items to test storage limits
      for (let i = 0; i < 50; i++) {
        const listData = {
          id: `offline-list-${i}`,
          title: `Offline List ${i}`,
          type: 'simple',
          user_id: userId,
          created_at: new Date().toISOString()
        }

        await mockIDB.set(`list:${listData.id}`, listData)
        currentStorageItems++

        // Add multiple items per list
        const items = []
        for (let j = 0; j < 10; j++) {
          const item = {
            id: `offline-item-${i}-${j}`,
            list_id: listData.id,
            content: `Item ${j} for List ${i}`,
            sort_order: j,
            created_at: new Date().toISOString()
          }
          items.push(item)
          currentStorageItems++
        }

        await mockIDB.set(`list:${listData.id}:items`, items)
      }

      // Verify storage count
      expect(currentStorageItems).toBe(550) // 50 lists + 500 items

      // Simulate storage cleanup when approaching limit
      if (currentStorageItems > maxStorageItems * 0.8) {
        // Remove oldest items first
        const allKeys = await mockIDB.keys()
        const listKeys = allKeys.filter(key => key.startsWith('list:') && !key.includes(':items'))

        // Sort by creation date and remove oldest
        const listsToClean = listKeys.slice(0, 10) // Remove oldest 10 lists

        for (const listKey of listsToClean) {
          await mockIDB.delete(listKey)
          const listId = listKey.split(':')[1]
          await mockIDB.delete(`list:${listId}:items`)
        }

        // Verify cleanup
        const remainingKeys = await mockIDB.keys()
        const remainingLists = remainingKeys.filter(key => key.startsWith('list:') && !key.includes(':items'))
        expect(remainingLists).toHaveLength(40)
      }

      // Test storage size estimation
      const storageEstimate = {
        used: currentStorageItems * 500, // Rough estimate: 500 bytes per item
        quota: maxStorageItems * 500,
        percentUsed: (currentStorageItems / maxStorageItems) * 100
      }

      expect(storageEstimate.percentUsed).toBeGreaterThan(50)
      expect(storageEstimate.used).toBeLessThan(storageEstimate.quota)
    })

    it('should optimize sync performance for large datasets', async () => {
      // Create large dataset to test sync performance
      const largeDataset = []

      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          id: `bulk-item-${i}`,
          type: 'create',
          table: 'items',
          data: {
            list_id: 'bulk-list-id',
            content: `Bulk item ${i}`,
            sort_order: i,
            created_at: new Date().toISOString()
          }
        })
      }

      await mockIDB.set('bulkPendingOps', largeDataset)

      // Batch sync operations for performance
      const batchSize = 20
      const batches = []

      for (let i = 0; i < largeDataset.length; i += batchSize) {
        batches.push(largeDataset.slice(i, i + batchSize))
      }

      const startTime = Date.now()
      const batchResults = []

      for (const batch of batches) {
        const batchStartTime = Date.now()

        // Simulate batch processing
        const batchPromises = batch.map(async op => {
          // Simulate operation processing time
          await new Promise(resolve => setTimeout(resolve, 10))
          return { id: op.id, success: true }
        })

        const batchResult = await Promise.all(batchPromises)
        const batchEndTime = Date.now()

        batchResults.push({
          size: batch.length,
          duration: batchEndTime - batchStartTime,
          results: batchResult
        })
      }

      const totalTime = Date.now() - startTime

      // Verify batch performance
      expect(batches).toHaveLength(5) // 100 items / 20 per batch
      expect(batchResults).toHaveLength(5)
      expect(totalTime).toBeLessThan(2000) // Should complete in under 2 seconds

      const avgBatchTime = totalTime / batches.length
      expect(avgBatchTime).toBeLessThan(500) // 500ms per batch max

      // Verify all operations processed
      const totalProcessed = batchResults.reduce((sum, batch) => sum + batch.results.length, 0)
      expect(totalProcessed).toBe(100)
    })
  })
})