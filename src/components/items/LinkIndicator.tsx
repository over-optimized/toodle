import { useLinking } from '../../hooks'
import type { ItemLinkSummary } from '../../types/enhanced-linking'

interface LinkIndicatorProps {
  itemId: string
  showDetails?: boolean
  className?: string
  onClick?: () => void
}

/**
 * Enhanced LinkIndicator with hierarchical relationship support
 * Shows parent (↑), child (↑), and bidirectional (↔) link counts
 * Now uses TanStack Query via useLinking hook for caching and real-time updates
 */
export function LinkIndicator({ itemId, showDetails = false, className = '', onClick }: LinkIndicatorProps) {
  const { linkSummary, hasLinks } = useLinking(itemId)

  // Don't show indicator if no links or still loading
  if (!hasLinks || linkSummary.isLoading || !linkSummary.data) {
    return null
  }

  const summary = linkSummary.data
  const totalLinks = summary.total_links

  if (totalLinks === 0) {
    return null
  }

  // Build tooltip text
  const tooltipParts: string[] = []
  if (summary.parents_count > 0) {
    tooltipParts.push(`${summary.parents_count} parent${summary.parents_count > 1 ? 's' : ''}`)
  }
  if (summary.children_count > 0) {
    tooltipParts.push(`${summary.children_count} child${summary.children_count > 1 ? 'ren' : ''}`)
  }
  if (summary.bidirectional_count > 0) {
    tooltipParts.push(`${summary.bidirectional_count} linked`)
  }
  const tooltipText = tooltipParts.join(', ')

  if (showDetails) {
    return (
      <div className={`text-xs text-gray-600 ${className}`}>
        <div className="flex items-center space-x-2">
          {summary.parents_count > 0 && (
            <span className="text-purple-600" title="Parent links">
              ↑ {summary.parents_count}
            </span>
          )}
          {summary.children_count > 0 && (
            <span className="text-green-600" title="Child links">
              ↓ {summary.children_count}
            </span>
          )}
          {summary.bidirectional_count > 0 && (
            <span className="text-blue-600" title="Informational links">
              ↔ {summary.bidirectional_count}
            </span>
          )}
        </div>
      </div>
    )
  }

  const content = (
    <div className="inline-flex items-center space-x-1">
      {summary.parents_count > 0 && (
        <span className="text-purple-600 text-sm" title="Parent links">
          ↑
        </span>
      )}
      {summary.children_count > 0 && (
        <span className="text-green-600 text-sm" title="Child links">
          ↓
        </span>
      )}
      {summary.bidirectional_count > 0 && (
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