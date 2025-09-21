import { useAuth } from '../../hooks/useAuth'
import type { Share, List } from '../../types'

interface PermissionGuardProps {
  list: List
  share?: Share
  requiredPermission: 'read' | 'write'
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  list,
  share,
  requiredPermission,
  children,
  fallback
}: PermissionGuardProps) {
  const { user } = useAuth()

  // If user owns the list, they have full permissions
  if (user && list.user_id === user.id) {
    return <>{children}</>
  }

  // If no share context, check if list is public
  if (!share) {
    // Private lists require authentication and ownership
    if (list.is_private && !user) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Please sign in to access this list.
          </p>
        </div>
      )
    }

    // For public lists, allow read access
    if (!list.is_private && requiredPermission === 'read') {
      return <>{children}</>
    }

    // For public lists, only owner can write
    if (!list.is_private && requiredPermission === 'write') {
      return (
        fallback || (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              You don't have permission to edit this list.
            </p>
          </div>
        )
      )
    }
  }

  // Check share permissions
  if (share) {
    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            This share link has expired.
          </p>
        </div>
      )
    }

    // Check if user matches the share (for user-specific shares)
    if (share.shared_with_user_id && user?.id !== share.shared_with_user_id) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            This list is shared with a different user.
          </p>
        </div>
      )
    }

    // Check permission level
    if (requiredPermission === 'read') {
      // Read permission is always granted if share exists
      return <>{children}</>
    }

    if (requiredPermission === 'write') {
      if (share.permission === 'write') {
        return <>{children}</>
      } else {
        return (
          fallback || (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                You have read-only access to this list.
              </p>
            </div>
          )
        )
      }
    }
  }

  // Default fallback
  return (
    fallback || (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-800">
          You don't have permission to access this content.
        </p>
      </div>
    )
  )
}

// Hook version for programmatic permission checking
export function usePermissions(list: List, share?: Share) {
  const { user } = useAuth()

  const isOwner = user && list.user_id === user.id
  const isAuthenticated = !!user

  // Check if user has read permission
  const canRead = () => {
    // Owner can always read
    if (isOwner) return true

    // Public lists can be read by anyone
    if (!list.is_private) return true

    // Check share permissions
    if (share) {
      // Check expiry
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return false
      }

      // Check if user matches share target
      if (share.shared_with_user_id && user?.id !== share.shared_with_user_id) {
        return false
      }

      // If we have a valid share, read is allowed
      return true
    }

    return false
  }

  // Check if user has write permission
  const canWrite = () => {
    // Owner can always write
    if (isOwner) return true

    // Check share permissions
    if (share) {
      // Check expiry
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return false
      }

      // Check if user matches share target
      if (share.shared_with_user_id && user?.id !== share.shared_with_user_id) {
        return false
      }

      // Check permission level
      return share.permission === 'write'
    }

    return false
  }

  // Check if user can share the list
  const canShare = () => {
    return isOwner
  }

  // Check if user can delete the list
  const canDelete = () => {
    return isOwner
  }

  // Get permission level string
  const getPermissionLevel = (): 'none' | 'read' | 'write' | 'owner' => {
    if (isOwner) return 'owner'
    if (canWrite()) return 'write'
    if (canRead()) return 'read'
    return 'none'
  }

  // Get permission context for UI
  const getPermissionContext = () => {
    if (isOwner) {
      return {
        level: 'owner' as const,
        message: 'You own this list',
        canEdit: true,
        canShare: true,
        canDelete: true
      }
    }

    if (share) {
      const isExpired = share.expires_at && new Date(share.expires_at) < new Date()
      if (isExpired) {
        return {
          level: 'none' as const,
          message: 'Share link has expired',
          canEdit: false,
          canShare: false,
          canDelete: false
        }
      }

      if (share.permission === 'write') {
        return {
          level: 'write' as const,
          message: 'You can edit this shared list',
          canEdit: true,
          canShare: false,
          canDelete: false
        }
      } else {
        return {
          level: 'read' as const,
          message: 'You have read-only access',
          canEdit: false,
          canShare: false,
          canDelete: false
        }
      }
    }

    if (!list.is_private) {
      return {
        level: 'read' as const,
        message: 'This is a public list',
        canEdit: false,
        canShare: false,
        canDelete: false
      }
    }

    return {
      level: 'none' as const,
      message: 'You don\'t have access to this list',
      canEdit: false,
      canShare: false,
      canDelete: false
    }
  }

  return {
    isOwner,
    isAuthenticated,
    canRead: canRead(),
    canWrite: canWrite(),
    canShare: canShare(),
    canDelete: canDelete(),
    permissionLevel: getPermissionLevel(),
    permissionContext: getPermissionContext()
  }
}

// Wrapper component for conditional rendering based on permissions
interface ConditionalRenderProps {
  list: List
  share?: Share
  permission: 'read' | 'write' | 'owner'
  children: React.ReactNode
}

export function ConditionalRender({ list, share, permission, children }: ConditionalRenderProps) {
  const permissions = usePermissions(list, share)

  const hasPermission = () => {
    switch (permission) {
      case 'read':
        return permissions.canRead
      case 'write':
        return permissions.canWrite
      case 'owner':
        return permissions.isOwner
      default:
        return false
    }
  }

  return hasPermission() ? <>{children}</> : null
}