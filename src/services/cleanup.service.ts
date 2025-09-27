import { supabase } from '../lib/supabase'

export class CleanupService {
  /**
   * Clean up expired shares
   * Shares are considered expired if they haven't been accessed in 30 days
   */
  static async cleanupExpiredShares(): Promise<{
    success: boolean
    deletedCount: number
    error?: string
  }> {
    try {
      // Calculate the expiration date (30 days ago)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() - 30)

      // Delete shares that haven't been updated in 30 days
      // Note: We use updated_at as a proxy for last accessed
      const { data, error } = await supabase
        .from('shares')
        .delete()
        .lt('updated_at', expirationDate.toISOString())
        .select()

      if (error) {
        console.error('Error cleaning up expired shares:', error)
        return {
          success: false,
          deletedCount: 0,
          error: error.message
        }
      }

      const deletedCount = data?.length || 0
      console.log(`Cleaned up ${deletedCount} expired shares`)

      return {
        success: true,
        deletedCount
      }
    } catch (error) {
      console.error('Unexpected error during cleanup:', error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clean up orphaned data (items without lists, shares without lists)
   */
  static async cleanupOrphanedData(): Promise<{
    success: boolean
    itemsDeleted: number
    sharesDeleted: number
    error?: string
  }> {
    try {
      // Clean up items whose lists no longer exist
      const { data: orphanedItems, error: itemsError } = await supabase
        .from('items')
        .delete()
        .not('list_id', 'in', `(SELECT id FROM lists)`)
        .select()

      if (itemsError) {
        console.error('Error cleaning up orphaned items:', itemsError)
        return {
          success: false,
          itemsDeleted: 0,
          sharesDeleted: 0,
          error: itemsError.message
        }
      }

      // Clean up shares whose lists no longer exist
      const { data: orphanedShares, error: sharesError } = await supabase
        .from('shares')
        .delete()
        .not('list_id', 'in', `(SELECT id FROM lists)`)
        .select()

      if (sharesError) {
        console.error('Error cleaning up orphaned shares:', sharesError)
        return {
          success: false,
          itemsDeleted: orphanedItems?.length || 0,
          sharesDeleted: 0,
          error: sharesError.message
        }
      }

      const itemsDeleted = orphanedItems?.length || 0
      const sharesDeleted = orphanedShares?.length || 0

      console.log(`Cleaned up ${itemsDeleted} orphaned items and ${sharesDeleted} orphaned shares`)

      return {
        success: true,
        itemsDeleted,
        sharesDeleted
      }
    } catch (error) {
      console.error('Unexpected error during orphaned data cleanup:', error)
      return {
        success: false,
        itemsDeleted: 0,
        sharesDeleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clean up old completed items (older than 90 days)
   * This helps keep the database size manageable
   */
  static async cleanupOldCompletedItems(): Promise<{
    success: boolean
    deletedCount: number
    error?: string
  }> {
    try {
      // Calculate the cutoff date (90 days ago)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)

      // Delete completed items older than 90 days
      const { data, error } = await supabase
        .from('items')
        .delete()
        .eq('is_completed', true)
        .lt('completed_at', cutoffDate.toISOString())
        .select()

      if (error) {
        console.error('Error cleaning up old completed items:', error)
        return {
          success: false,
          deletedCount: 0,
          error: error.message
        }
      }

      const deletedCount = data?.length || 0
      console.log(`Cleaned up ${deletedCount} old completed items`)

      return {
        success: true,
        deletedCount
      }
    } catch (error) {
      console.error('Unexpected error during old items cleanup:', error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Run comprehensive cleanup
   * This should be called periodically (e.g., daily via cron job)
   */
  static async runFullCleanup(): Promise<{
    success: boolean
    summary: {
      expiredShares: number
      orphanedItems: number
      orphanedShares: number
      oldCompletedItems: number
    }
    errors: string[]
  }> {
    const errors: string[] = []
    const summary = {
      expiredShares: 0,
      orphanedItems: 0,
      orphanedShares: 0,
      oldCompletedItems: 0
    }

    // Clean up expired shares
    const expiredSharesResult = await this.cleanupExpiredShares()
    if (expiredSharesResult.success) {
      summary.expiredShares = expiredSharesResult.deletedCount
    } else if (expiredSharesResult.error) {
      errors.push(`Expired shares cleanup: ${expiredSharesResult.error}`)
    }

    // Clean up orphaned data
    const orphanedDataResult = await this.cleanupOrphanedData()
    if (orphanedDataResult.success) {
      summary.orphanedItems = orphanedDataResult.itemsDeleted
      summary.orphanedShares = orphanedDataResult.sharesDeleted
    } else if (orphanedDataResult.error) {
      errors.push(`Orphaned data cleanup: ${orphanedDataResult.error}`)
    }

    // Clean up old completed items
    const oldItemsResult = await this.cleanupOldCompletedItems()
    if (oldItemsResult.success) {
      summary.oldCompletedItems = oldItemsResult.deletedCount
    } else if (oldItemsResult.error) {
      errors.push(`Old items cleanup: ${oldItemsResult.error}`)
    }

    const totalCleaned = summary.expiredShares + summary.orphanedItems +
                        summary.orphanedShares + summary.oldCompletedItems

    console.log(`Full cleanup completed. Total items cleaned: ${totalCleaned}`, summary)

    return {
      success: errors.length === 0,
      summary,
      errors
    }
  }

  /**
   * Get cleanup statistics without performing cleanup
   */
  static async getCleanupStats(): Promise<{
    expiredShares: number
    orphanedItems: number
    orphanedShares: number
    oldCompletedItems: number
    error?: string
  }> {
    try {
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() - 30)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)

      // Count expired shares
      const { count: expiredShares, error: sharesError } = await supabase
        .from('shares')
        .select('*', { count: 'exact', head: true })
        .lt('updated_at', expirationDate.toISOString())

      if (sharesError) throw sharesError

      // Count old completed items
      const { count: oldCompletedItems, error: itemsError } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('is_completed', true)
        .lt('completed_at', cutoffDate.toISOString())

      if (itemsError) throw itemsError

      return {
        expiredShares: expiredShares || 0,
        orphanedItems: 0, // Complex query, would need separate implementation
        orphanedShares: 0, // Complex query, would need separate implementation
        oldCompletedItems: oldCompletedItems || 0
      }
    } catch (error) {
      console.error('Error getting cleanup stats:', error)
      return {
        expiredShares: 0,
        orphanedItems: 0,
        orphanedShares: 0,
        oldCompletedItems: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}