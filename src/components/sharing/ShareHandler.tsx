import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { shareService } from '../../services/share.service'
import { listService } from '../../services/list.service'
import type { Share, List } from '../../types'

interface ShareHandlerProps {
  children: (data: { list: List; share: Share; isLoading: boolean; error: string | null }) => React.ReactNode
}

export function ShareHandler({ children }: ShareHandlerProps) {
  const { shareId } = useParams<{ shareId: string }>()
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [list, setList] = useState<List | null>(null)
  const [share, setShare] = useState<Share | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSharedList = async () => {
      if (!shareId) {
        setError('Invalid share link')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // First, get the share details
        const shareResult = await shareService.getShare(shareId)
        if (shareResult.error || !shareResult.data) {
          setError(shareResult.error || 'Share not found')
          setIsLoading(false)
          return
        }

        const shareData = shareResult.data

        // Check if share has expired
        if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
          setError('This share link has expired')
          setIsLoading(false)
          return
        }

        // Get the list details
        const listResult = await listService.getList(shareData.list_id)
        if (listResult.error || !listResult.data) {
          setError(listResult.error || 'List not found')
          setIsLoading(false)
          return
        }

        setShare(shareData)
        setList(listResult.data)
        setIsLoading(false)

        // If user is authenticated and the share is for them specifically,
        // we could redirect to the normal list view
        if (user && shareData.shared_with_user_id === user.id) {
          navigate(`/lists/${listResult.data.id}`)
          return
        }

      } catch (error) {
        console.error('Failed to load shared list:', error)
        setError('Failed to load shared list')
        setIsLoading(false)
      }
    }

    if (!authLoading) {
      loadSharedList()
    }
  }, [shareId, user, authLoading, navigate])

  // Show loading state while auth or share data loads
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to access shared list</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Render children with loaded data
  if (list && share) {
    return (
      <div>
        {children({ list, share, isLoading: false, error: null })}
      </div>
    )
  }

  return null
}

// Standalone component for shared list pages
export function SharedListPage() {
  return (
    <ShareHandler>
      {({ list, share, isLoading, error }) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )
        }

        if (error) {
          return (
            <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )
        }

        return (
          <div className="max-w-4xl mx-auto p-4">
            {/* Shared list indicator */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">
                  Shared list • {share.permission === 'read' ? 'View only' : 'Can edit'}
                </span>
                {share.expires_at && (
                  <span className="text-xs text-blue-600">
                    Expires {new Date(share.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* List content */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">{list.title}</h1>
              {list.description && (
                <p className="text-gray-600 mb-6">{list.description}</p>
              )}

              {/* Note about permissions */}
              {share.permission === 'read' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This is a read-only view. You can see the items but cannot make changes.
                  </p>
                </div>
              )}

              {/* List items would be rendered here */}
              <div className="space-y-2">
                <p className="text-gray-500 text-center py-8">
                  List items would be displayed here based on the list type and permissions.
                </p>
              </div>
            </div>
          </div>
        )
      }}
    </ShareHandler>
  )
}