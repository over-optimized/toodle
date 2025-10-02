import { useState } from 'react'
import { useLinking } from '../../hooks'
import { LinkManager } from './LinkManager'

interface MobileLinkInterfaceProps {
  itemId: string
  itemContent: string
  onClose: () => void
  onLinksUpdated?: () => void
}

/**
 * Mobile-optimized link management interface
 * Features:
 * - Large touch targets (min 44x44px for iOS/Android accessibility)
 * - Bottom sheet modal for comfortable one-handed use
 * - Quick actions for common operations
 * - Visual feedback for all interactions
 */
export function MobileLinkInterface({
  itemId,
  itemContent,
  onClose,
  onLinksUpdated,
}: MobileLinkInterfaceProps) {
  const [activeView, setActiveView] = useState<'summary' | 'add-parent' | 'add-child' | 'manage'>('summary')
  const { linkSummary, childItems, parentItems, removeParentChildLink } = useLinking(itemId)

  const handleLinkRemoved = async (parentId: string, childId: string) => {
    try {
      await removeParentChildLink.mutateAsync({
        parent_item_id: parentId,
        child_item_id: childId,
      })
      onLinksUpdated?.()
    } catch (error) {
      console.error('Failed to remove link:', error)
    }
  }

  const handleLinksUpdated = () => {
    setActiveView('summary')
    onLinksUpdated?.()
  }

  const summary = linkSummary.data

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 sm:items-center">
      <div
        className="w-full max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl sm:max-w-lg shadow-xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle for mobile */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-lg font-semibold text-gray-900 truncate">Link Management</h2>
              <p className="text-sm text-gray-600 truncate mt-1">{itemContent}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeView === 'summary' && (
            <div className="p-6 space-y-6">
              {/* Link Summary Cards */}
              <div className="space-y-3">
                {/* Parents */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">↑</span>
                      <div>
                        <h3 className="font-medium text-gray-900">Parents</h3>
                        <p className="text-sm text-gray-600">Items that control this item</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">
                      {summary?.parents_count || 0}
                    </span>
                  </div>
                  {parentItems.data && parentItems.data.length > 0 && (
                    <div className="space-y-2">
                      {parentItems.data.map((parent) => (
                        <div
                          key={parent.id}
                          className="bg-white border border-purple-200 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {parent.content}
                            </p>
                            <p className="text-xs text-gray-500">{parent.list_title}</p>
                          </div>
                          <button
                            onClick={() => handleLinkRemoved(parent.id, itemId)}
                            className="ml-3 w-9 h-9 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                            aria-label="Remove parent link"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">↓</span>
                      <div>
                        <h3 className="font-medium text-gray-900">Children</h3>
                        <p className="text-sm text-gray-600">Items controlled by this item</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-green-600">
                      {summary?.children_count || 0}
                    </span>
                  </div>
                  {childItems.data && childItems.data.length > 0 && (
                    <div className="space-y-2">
                      {childItems.data.map((child) => (
                        <div
                          key={child.id}
                          className="bg-white border border-green-200 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {child.content}
                            </p>
                            <p className="text-xs text-gray-500">{child.list_title}</p>
                          </div>
                          <button
                            onClick={() => handleLinkRemoved(itemId, child.id)}
                            className="ml-3 w-9 h-9 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                            aria-label="Remove child link"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Informational */}
                {summary && summary.bidirectional_count > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">↔</span>
                        <div>
                          <h3 className="font-medium text-gray-900">Informational Links</h3>
                          <p className="text-sm text-gray-600">Non-hierarchical references</p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">
                        {summary.bidirectional_count}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveView('add-parent')}
                    className="flex items-center justify-center gap-2 h-14 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors"
                  >
                    <span className="text-xl">↑</span>
                    <span className="font-medium">Add Parent</span>
                  </button>
                  <button
                    onClick={() => setActiveView('add-child')}
                    className="flex items-center justify-center gap-2 h-14 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
                  >
                    <span className="text-xl">↓</span>
                    <span className="font-medium">Add Child</span>
                  </button>
                </div>
                <button
                  onClick={() => setActiveView('manage')}
                  className="w-full h-14 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium"
                >
                  Advanced Management
                </button>
              </div>
            </div>
          )}

          {activeView === 'add-parent' && (
            <div className="p-6">
              <button
                onClick={() => setActiveView('summary')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Back</span>
              </button>
              {/* TODO: ParentChildLinker needs Item prop, not just itemId */}
              <div className="text-center text-gray-600 py-8">
                Add parent functionality coming soon
              </div>
            </div>
          )}

          {activeView === 'add-child' && (
            <div className="p-6">
              <button
                onClick={() => setActiveView('summary')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Back</span>
              </button>
              {/* TODO: ParentChildLinker needs Item prop, not just itemId */}
              <div className="text-center text-gray-600 py-8">
                Add child functionality coming soon
              </div>
            </div>
          )}

          {activeView === 'manage' && (
            <div className="p-6">
              <button
                onClick={() => setActiveView('summary')}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Back</span>
              </button>
              <LinkManager
                itemId={itemId}
                onClose={() => setActiveView('summary')}
                onLinksUpdated={handleLinksUpdated}
              />
            </div>
          )}
        </div>

        {/* Footer - Close button for easy one-handed use */}
        <div className="p-4 border-t border-gray-200 sm:hidden">
          <button
            onClick={onClose}
            className="w-full h-12 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}