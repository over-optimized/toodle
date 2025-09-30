import { useState, useEffect } from 'react'
import { enhancedLinkingService } from '../../services'
import type { Item } from '../../types'
import type { ItemLinkSummary } from '../../types/enhanced-linking'

interface LinkManagerProps {
  item: Item
  onLinksUpdated: () => void
  onClose: () => void
  onOpenParentChildLinker?: () => void
  onOpenItemLinker?: () => void
}

/**
 * Comprehensive link management interface
 * Displays all links (parent, child, bidirectional) with ability to remove
 */
export function LinkManager({
  item,
  onLinksUpdated,
  onClose,
  onOpenParentChildLinker,
  onOpenItemLinker
}: LinkManagerProps) {
  const [linkSummary, setLinkSummary] = useState<ItemLinkSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLinkSummary()
  }, [item.id])

  const loadLinkSummary = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await enhancedLinkingService.getLinkSummary(item.id)
      if (result.error) {
        setError(`Failed to load links: ${result.error}`)
        return
      }

      setLinkSummary(result.data || null)
    } catch (err) {
      setError('Failed to load link data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveParent = async (parentId: string) => {
    setRemovingLinkId(parentId)
    setError('')

    try {
      // Remove from parent's perspective
      const result = await enhancedLinkingService.removeParentChildLink(parentId, item.id)
      if (result.error) {
        setError(`Failed to remove parent link: ${result.error}`)
        return
      }

      onLinksUpdated()
      await loadLinkSummary()
    } catch (err) {
      setError('Failed to remove parent link')
    } finally {
      setRemovingLinkId(null)
    }
  }

  const handleRemoveChild = async (childId: string) => {
    setRemovingLinkId(childId)
    setError('')

    try {
      const result = await enhancedLinkingService.removeParentChildLink(item.id, childId)
      if (result.error) {
        setError(`Failed to remove child link: ${result.error}`)
        return
      }

      onLinksUpdated()
      await loadLinkSummary()
    } catch (err) {
      setError('Failed to remove child link')
    } finally {
      setRemovingLinkId(null)
    }
  }

  const handleRemoveBidirectional = async (linkedItemId: string) => {
    setRemovingLinkId(linkedItemId)
    setError('')

    try {
      const result = await enhancedLinkingService.removeBidirectionalLink(item.id, linkedItemId)
      if (result.error) {
        setError(`Failed to remove link: ${result.error}`)
        return
      }

      onLinksUpdated()
      await loadLinkSummary()
    } catch (err) {
      setError('Failed to remove link')
    } finally {
      setRemovingLinkId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading links...</span>
          </div>
        </div>
      </div>
    )
  }

  const hasAnyLinks = linkSummary && linkSummary.total_links > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Manage Links</h3>
          <p className="text-sm text-gray-600 mt-1">
            View and manage all links for "{item.content}"
          </p>
          {linkSummary && (
            <p className="text-xs text-gray-500 mt-1">
              {linkSummary.total_links} total link(s)
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {!hasAnyLinks ? (
            <div className="text-center text-gray-500 py-8">
              <p>No links yet.</p>
              <p className="text-sm mt-2">
                Use the buttons below to create parent-child or informational links.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Parent Links */}
              {linkSummary && linkSummary.parents_count > 0 && (
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-purple-600 text-lg mr-2">↑</span>
                    <h4 className="font-medium text-gray-900">
                      Parent Items ({linkSummary.parents_count})
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    When these items complete, this item automatically completes
                  </p>
                  <div className="space-y-2">
                    {linkSummary.parents.map(parent => (
                      <div
                        key={parent.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className={`text-sm ${parent.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {parent.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {parent.list_title} ({parent.list_type})
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveParent(parent.id)}
                          disabled={removingLinkId === parent.id}
                          className="ml-3 px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          {removingLinkId === parent.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Child Links */}
              {linkSummary && linkSummary.children_count > 0 && (
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-green-600 text-lg mr-2">↓</span>
                    <h4 className="font-medium text-gray-900">
                      Child Items ({linkSummary.children_count})
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    When this item completes, these items automatically complete
                  </p>
                  <div className="space-y-2">
                    {linkSummary.children.map(child => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className={`text-sm ${child.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {child.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {child.list_title} ({child.list_type})
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveChild(child.id)}
                          disabled={removingLinkId === child.id}
                          className="ml-3 px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          {removingLinkId === child.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bidirectional/Informational Links */}
              {linkSummary && linkSummary.bidirectional_count > 0 && (
                <div>
                  <div className="flex items-center mb-3">
                    <span className="text-blue-600 text-lg mr-2">↔</span>
                    <h4 className="font-medium text-gray-900">
                      Related Items ({linkSummary.bidirectional_count})
                    </h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Informational links with no status propagation
                  </p>
                  <div className="space-y-2">
                    {linkSummary.bidirectional.map(linked => (
                      <div
                        key={linked.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className={`text-sm ${linked.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {linked.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {linked.list_title} ({linked.list_type})
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveBidirectional(linked.id)}
                          disabled={removingLinkId === linked.id}
                          className="ml-3 px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          {removingLinkId === linked.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            {onOpenParentChildLinker && (
              <button
                onClick={onOpenParentChildLinker}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
              >
                <span className="mr-2">↓</span>
                Add Child Items
              </button>
            )}
            {onOpenItemLinker && (
              <button
                onClick={onOpenItemLinker}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
              >
                <span className="mr-2">↔</span>
                Add Related Items
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 border rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}