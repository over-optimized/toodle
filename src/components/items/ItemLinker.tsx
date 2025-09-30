import type { Item } from '../../types'

interface ItemLinkerProps {
  sourceItem: Item
  onLinksUpdated: () => void
  onClose: () => void
}

/**
 * ItemLinker Component - DEPRECATED
 *
 * This component previously supported bidirectional/informational linking.
 * The new enhanced linking system focuses on parent-child hierarchical relationships.
 *
 * For linking items, use:
 * - ParentChildLinker: Create parent-child hierarchical relationships
 * - LinkManager: Manage all links for a specific item
 * - MobileLinkInterface: Mobile-optimized link management
 */
export function ItemLinker({ sourceItem, onClose }: ItemLinkerProps) {
  const handleUseNewInterface = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-lg w-full mx-4 p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Bidirectional Linking Not Available
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            You're trying to create informational links for "{sourceItem.content}".
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6 text-left">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Why bidirectional linking is disabled:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>The enhanced linking system focuses on parent-child hierarchies</li>
              <li>Parent-child relationships provide automatic status propagation</li>
              <li>Informational links without hierarchy are not currently supported</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-md p-4 mb-6 text-left">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              How to create hierarchical links:
            </h4>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">→</span>
                <span>Click an item's link indicator (↑↓) to manage its links</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-600 mr-2">→</span>
                <span>Use "Add Parent" to make this item controlled by another</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">→</span>
                <span>Use "Add Child" to make this item control others</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleUseNewInterface}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
