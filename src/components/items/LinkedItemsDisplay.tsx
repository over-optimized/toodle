import { useState, useEffect } from 'react'
import { linkingService } from '../../services'
import type { ItemLinkingSummary } from '../../types'

interface LinkedItemsDisplayProps {
  itemId: string
  onLinkRemoved?: () => void
}

export function LinkedItemsDisplay({ itemId, onLinkRemoved }: LinkedItemsDisplayProps) {
  const [linkingSummary, setLinkingSummary] = useState<ItemLinkingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLinkingSummary()
  }, [itemId])

  const loadLinkingSummary = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await linkingService.getItemLinkingSummary(itemId)

      if (result.error) {
        setError(result.error)
        return
      }

      setLinkingSummary(result.data)
    } catch (err) {
      setError('Failed to load linking information')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveLink = async (sourceItemId: string, targetItemId: string) => {
    try {
      const result = await linkingService.removeLinks(sourceItemId, [targetItemId])

      if (result.error) {
        setError(result.error)
        return
      }

      await loadLinkingSummary()
      onLinkRemoved?.()
    } catch (err) {
      setError('Failed to remove link')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        <span>Loading links...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
        {error}
      </div>
    )
  }

  if (!linkingSummary || (linkingSummary.totalLinkedTo === 0 && linkingSummary.totalLinkingFrom === 0)) {
    return null
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Items this item links to */}
      {linkingSummary.totalLinkedTo > 0 && (
        <div className="text-sm">
          <div className="text-xs text-gray-500 mb-1">
            Links to ({linkingSummary.totalLinkedTo}):
          </div>
          <div className="space-y-1">
            {linkingSummary.linkedToItems.map(linkedItem => (
              <div key={linkedItem.id} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                <div className="flex-1">
                  <span className={linkedItem.is_completed ? 'line-through text-gray-500' : ''}>
                    {linkedItem.content}
                  </span>
                  <div className="text-xs text-gray-500">
                    in {linkedItem.list_title} ({linkedItem.list_type})
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveLink(itemId, linkedItem.id)}
                  className="text-red-500 hover:text-red-700 text-xs ml-2"
                  title="Remove link"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items that link to this item */}
      {linkingSummary.totalLinkingFrom > 0 && (
        <div className="text-sm">
          <div className="text-xs text-gray-500 mb-1">
            Linked from ({linkingSummary.totalLinkingFrom}):
          </div>
          <div className="space-y-1">
            {linkingSummary.linkingFromItems.map(linkingItem => (
              <div key={linkingItem.id} className="flex items-center justify-between bg-green-50 p-2 rounded">
                <div className="flex-1">
                  <span className={linkingItem.is_completed ? 'line-through text-gray-500' : ''}>
                    {linkingItem.content}
                  </span>
                  <div className="text-xs text-gray-500">
                    in {linkingItem.list_title} ({linkingItem.list_type})
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveLink(linkingItem.id, itemId)}
                  className="text-red-500 hover:text-red-700 text-xs ml-2"
                  title="Remove link"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}