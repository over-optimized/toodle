import { useState, useEffect } from 'react'
import { enhancedLinkingService } from '../../services'
import type { ItemLinkSummary } from '../../types/enhanced-linking'

interface LinkIndicatorProps {
  itemId: string
  showDetails?: boolean
  className?: string
  onClick?: () => void
}

/**
 * Enhanced LinkIndicator with hierarchical relationship support
 * Shows parent (↓), child (↑), and bidirectional (↔) link counts
 */
export function LinkIndicator({ itemId, showDetails = false, className = '', onClick }: LinkIndicatorProps) {
  const [linkSummary, setLinkSummary] = useState<ItemLinkSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLinkSummary()
  }, [itemId])

  const loadLinkSummary = async () => {
    setIsLoading(true)

    try {
      const result = await enhancedLinkingService.getLinkSummary(itemId)
      if (result.success && result.data) {
        setLinkSummary(result.data)
      }
    } catch (err) {
      // Silently fail for indicator
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !linkSummary) {
    return null
  }

  const totalLinks = linkSummary.total_links

  if (totalLinks === 0) {
    return null
  }

  // Build tooltip text
  const tooltipParts: string[] = []
  if (linkSummary.parents_count > 0) {
    tooltipParts.push(`${linkSummary.parents_count} parent${linkSummary.parents_count > 1 ? 's' : ''}`)
  }
  if (linkSummary.children_count > 0) {
    tooltipParts.push(`${linkSummary.children_count} child${linkSummary.children_count > 1 ? 'ren' : ''}`)
  }
  if (linkSummary.bidirectional_count > 0) {
    tooltipParts.push(`${linkSummary.bidirectional_count} linked`)
  }
  const tooltipText = tooltipParts.join(', ')

  if (showDetails) {
    return (
      <div className={`text-xs text-gray-600 ${className}`}>
        <div className="flex items-center space-x-2">
          {linkSummary.parents_count > 0 && (
            <span className="text-purple-600" title="Parent links">
              ↑ {linkSummary.parents_count}
            </span>
          )}
          {linkSummary.children_count > 0 && (
            <span className="text-green-600" title="Child links">
              ↓ {linkSummary.children_count}
            </span>
          )}
          {linkSummary.bidirectional_count > 0 && (
            <span className="text-blue-600" title="Informational links">
              ↔ {linkSummary.bidirectional_count}
            </span>
          )}
        </div>
      </div>
    )
  }

  const content = (
    <div className="inline-flex items-center space-x-1">
      {linkSummary.parents_count > 0 && (
        <span className="text-purple-600 text-sm" title="Parent links">
          ↑
        </span>
      )}
      {linkSummary.children_count > 0 && (
        <span className="text-green-600 text-sm" title="Child links">
          ↓
        </span>
      )}
      {linkSummary.bidirectional_count > 0 && (
        <span className="text-blue-600 text-sm" title="Informational links">
          ↔
        </span>
      )}
      <span className="text-xs text-gray-600 ml-1">{totalLinks}</span>
    </div>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center hover:bg-gray-100 rounded p-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${className}`}
        title={`${tooltipText} - Click to view`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`inline-flex items-center ${className}`} title={tooltipText}>
      {content}
    </div>
  )
}