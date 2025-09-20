import { offlineService } from '../services/offline.service'

export class BackgroundSyncManager {
  private isRegistered = false

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Background sync not supported')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready

      // Register for background sync
      await registration.sync.register('toodle-sync')
      this.isRegistered = true

      console.log('Background sync registered')
    } catch (error) {
      console.error('Failed to register background sync:', error)
    }
  }

  async requestSync(): Promise<void> {
    if (!this.isRegistered) {
      await this.register()
    }

    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      // Fallback to immediate sync if background sync not supported
      await offlineService.syncPendingOperations()
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('toodle-sync')
    } catch (error) {
      console.error('Failed to request background sync:', error)
      // Fallback to immediate sync
      await offlineService.syncPendingOperations()
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
  }
}

export const backgroundSync = new BackgroundSyncManager()

// Service Worker message handler
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      console.log('Background sync completed')

      // Notify components about sync completion
      window.dispatchEvent(new CustomEvent('sync-complete', {
        detail: {
          success: event.data.success,
          syncedCount: event.data.syncedCount,
          errors: event.data.errors
        }
      }))
    }
  })
}