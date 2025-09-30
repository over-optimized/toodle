import { useState, useEffect } from 'react'
import { enhancedLinkingService } from '../../services'
import type { Item, BulkLinkOperation } from '../../types'

interface BulkLinkerProps {
  selectedItems: Item[]
  onOperationComplete: () => void
  onClose: () => void
}

/**
 * Bulk Linker Component
 * IMPORTANT: This component only supports bidirectional/informational links
 * Parent-child hierarchical relationships CANNOT be created via bulk operations
 * to avoid ambiguous relationship directions
 */
export function BulkLinker({ selectedItems, onOperationComplete, onClose }: BulkLinkerProps) {
  const [targetItems, setTargetItems] = useState<Item[]>([])
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [operation, setOperation] = useState<'add' | 'remove' | 'replace'>('add')
  const [isLoading, setIsLoading] = useState(true)
  const [isOperating, setIsOperating] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Array<{ itemId: string; success: boolean; error?: string }>>([])

  useEffect(() => {
    loadTargetItems()
  }, [selectedItems])

  const loadTargetItems = async () => {
    if (selectedItems.length === 0) return

    setIsLoading(true)
    setError('')

    try {
      // Get linkable items for the first selected item as a base
      const result = await enhancedLinkingService.getLinkableItems(selectedItems[0].id)

      if (result.error) {
        setError(result.error)
        return
      }

      setTargetItems(result.data || [])
    } catch (err) {
      setError('Failed to load target items')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTargetToggle = (itemId: string) => {
    setSelectedTargets(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleBulkOperation = async () => {
    if (selectedTargets.length === 0) {
      setError('Please select target items')
      return
    }

    setIsOperating(true)
    setError('')
    const operationResults: Array<{ itemId: string; success: boolean; error?: string }> = []

    try {
      // Perform operation for each selected source item
      // Only bidirectional/informational links are created (no hierarchical relationships)
      for (const sourceItem of selectedItems) {
        let result

        if (operation === 'add') {
          result = await enhancedLinkingService.addBidirectionalLinks(sourceItem.id, selectedTargets)
        } else if (operation === 'remove') {
          // Remove each selected target individually
          for (const targetId of selectedTargets) {
            result = await enhancedLinkingService.removeBidirectionalLink(sourceItem.id, targetId)
            if (result.error) break
          }
        } else {
          // Replace
          result = await enhancedLinkingService.replaceBidirectionalLinks(sourceItem.id, selectedTargets)
        }

        operationResults.push({
          itemId: sourceItem.id,
          success: !result?.error,
          error: result?.error || undefined
        })
      }

      setResults(operationResults)

      // Check if all operations succeeded
      const allSucceeded = operationResults.every(r => r.success)
      if (allSucceeded) {
        onOperationComplete()
        onClose()
      }
    } catch (err) {
      setError('Failed to perform bulk operation')
    } finally {
      setIsOperating(false)
    }
  }

  const groupItemsByList = (items: Item[]) => {
    const groups: Record<string, Item[]> = {}

    items.forEach(item => {
      const listInfo = (item as any).lists
      const listKey = `${listInfo.title} (${listInfo.type})`

      if (!groups[listKey]) {
        groups[listKey] = []
      }
      groups[listKey].push(item)
    })

    return groups
  }

  const getOperationDescription = () => {
    switch (operation) {
      case 'add':
        return `Add links from ${selectedItems.length} item(s) to selected targets`
      case 'remove':
        return `Remove links from ${selectedItems.length} item(s) to selected targets`
      case 'replace':
        return `Replace all links for ${selectedItems.length} item(s) with selected targets`
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading target items...</span>
          </div>
        </div>
      </div>
    )
  }

  const groupedItems = groupItemsByList(targetItems)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="text-blue-600 mr-2">↔</span>
            Bulk Link Operation
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {selectedItems.length} item(s) selected for bulk linking
          </p>

          {/* Warning about hierarchical operations */}
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> This creates informational links only. For parent-child hierarchical
              relationships with status propagation, use the individual item link menu.
            </p>
          </div>

          {/* Operation Type Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operation Type
            </label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="add">Add Links (keep existing + add new)</option>
              <option value="remove">Remove Links (remove selected links)</option>
              <option value="replace">Replace Links (remove all + add new)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {getOperationDescription()}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">Operation Results:</h4>
              <div className="space-y-1 text-sm">
                {results.map((result, index) => (
                  <div key={index} className={`flex items-center ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="mr-2">{result.success ? '✓' : '✗'}</span>
                    <span>{selectedItems.find(item => item.id === result.itemId)?.content}</span>
                    {result.error && <span className="ml-2 text-xs">({result.error})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No target items available.</p>
              <p className="text-sm mt-2">Create items in other lists to link them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Select Target Items:</h4>
              {Object.entries(groupedItems).map(([listName, items]) => (
                <div key={listName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900">{listName}</h5>
                    <button
                      onClick={() => {
                        const listItemIds = items.map(item => item.id)
                        const allSelected = listItemIds.every(id => selectedTargets.includes(id))
                        if (allSelected) {
                          setSelectedTargets(prev => prev.filter(id => !listItemIds.includes(id)))
                        } else {
                          setSelectedTargets(prev => [...new Set([...prev, ...listItemIds])])
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {items.every(item => selectedTargets.includes(item.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => (
                      <label key={item.id} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTargets.includes(item.id)}
                          onChange={() => handleTargetToggle(item.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`flex-1 ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
                          {item.content}
                        </span>
                        {item.is_completed && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            Completed
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-6 flex justify-between">
          <button
            onClick={onClose}
            disabled={isOperating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-500">
              {selectedTargets.length} target(s) selected
            </div>
            <button
              onClick={handleBulkOperation}
              disabled={selectedTargets.length === 0 || isOperating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {isOperating && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {isOperating ? 'Processing...' : 'Execute Operation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}