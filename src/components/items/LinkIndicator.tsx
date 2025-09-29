import { useState, useEffect } from 'react'
import { linkingService } from '../../services'
import type { ItemLinkingSummary } from '../../types'

interface LinkIndicatorProps {
  itemId: string
  showDetails?: boolean
  className?: string
  onClick?: () => void
}

export function LinkIndicator({ itemId, showDetails = false, className = '', onClick }: LinkIndicatorProps) {
  const [linkingSummary, setLinkingSummary] = useState<ItemLinkingSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLinkingSummary()
  }, [itemId])

  const loadLinkingSummary = async () => {
    setIsLoading(true)

    try {
      const result = await linkingService.getItemLinkingSummary(itemId)
      if (result.data) {
        setLinkingSummary(result.data)
      }
    } catch (err) {
      // Silently fail for indicator
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !linkingSummary) {
    return null
  }

  const totalLinks = linkingSummary.totalLinkedTo + linkingSummary.totalLinkingFrom

  if (totalLinks === 0) {
    return null
  }

  if (showDetails) {
    return (
      <div className={`text-xs text-gray-600 ${className}`}>
        <div className="flex items-center space-x-2">
          <span className="text-blue-600">🔗</span>
          <span>
            {linkingSummary.totalLinkedTo > 0 && `→ ${linkingSummary.totalLinkedTo}`}
            {linkingSummary.totalLinkedTo > 0 && linkingSummary.totalLinkingFrom > 0 && ' • '}
            {linkingSummary.totalLinkingFrom > 0 && `← ${linkingSummary.totalLinkingFrom}`}
          </span>
        </div>
      </div>
    )
  }

  const content = (
    <>
      <span className="text-blue-600 text-sm">🔗</span>
      <span className="text-xs text-gray-600 ml-1">{totalLinks}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center hover:bg-gray-100 rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${className}`}
        title={`${totalLinks} linked item(s) - Click to view`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`inline-flex items-center ${className}`} title={`${totalLinks} linked item(s)`}>
      {content}
    </div>
  )
}