import { useState, useEffect } from 'react'
import { enhancedLinkingService, linkValidationService } from '../../services'
import type { Item, LinkedItemInfo } from '../../types'
import type { ValidateLinkCreationResponse } from '../../types/enhanced-linking'

interface ParentChildLinkerProps {
  parentItem: Item
  onLinksUpdated: () => void
  onClose: () => void
}

/**
 * Modal for creating parent-child hierarchical relationships
 * Parent items control child items via automatic status propagation
 */
export function ParentChildLinker({ parentItem, onLinksUpdated, onClose }: ParentChildLinkerProps) {
  const [linkableItems, setLinkableItems] = useState<Item[]>([])
  const [currentChildren, setCurrentChildren] = useState<LinkedItemInfo[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [validationResult, setValidationResult] = useState<ValidateLinkCreationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [parentItem.id])

  const loadData = async () => {
    setIsLoading(true)
    setError('')

    try {
      const [linkableResult, childrenResult] = await Promise.all([
        enhancedLinkingService.getLinkableItems(parentItem.id),
        enhancedLinkingService.getChildItems(parentItem.id)
      ])

      if (linkableResult.error) {
        setError(`Failed to load linkable items: ${linkableResult.error}`)
        return
      }

      if (childrenResult.error) {
        setError(`Failed to load current children: ${childrenResult.error}`)
        return
      }

      setLinkableItems(linkableResult.data || [])
      setCurrentChildren(childrenResult.data || [])
      setSelectedItems(childrenResult.data?.map(item => item.id) || [])
    } catch (err) {
      setError('Failed to load linking data')
    } finally {
      setIsLoading(false)
    }
  }

  const validateSelection = async (itemIds: string[]) => {
    if (itemIds.length === 0) {
      setValidationResult(null)
      return
    }

    const result = await linkValidationService.validateLinkCreation(parentItem.id, itemIds)
    if (result.success && result.data) {
      setValidationResult(result.data)
    }
  }

  const handleItemToggle = async (itemId: string) => {
    const newSelection = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId]

    setSelectedItems(newSelection)
    await validateSelection(newSelection)
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)

    try {
      // Remove children that were deselected
      const childrenToRemove = currentChildren
        .filter(child => !selectedItems.includes(child.id))
        .map(child => child.id)

      for (const childId of childrenToRemove) {
        const result = await enhancedLinkingService.removeParentChildLink(parentItem.id, childId)
        if (result.error) {
          setError(`Failed to remove link: ${result.error}`)
          return
        }
      }

      // Add newly selected children
      const childrenToAdd = selectedItems.filter(
        id => !currentChildren.some(child => child.id === id)
      )

      if (childrenToAdd.length > 0) {
        const result = await enhancedLinkingService.createParentChildLink(
          parentItem.id,
          childrenToAdd
        )

        if (result.error) {
          setError(`Failed to create links: ${result.error}`)
          return
        }
      }

      onLinksUpdated()
      onClose()
    } catch (err) {
      setError('Failed to save parent-child links')
    } finally {
      setIsSaving(false)
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

  const getItemValidationStatus = (itemId: string): 'valid' | 'invalid' | 'unknown' => {
    if (!validationResult) return 'unknown'
    if (validationResult.valid_links.includes(itemId)) return 'valid'
    if (validationResult.invalid_links.some(inv => inv.child_id === itemId)) return 'invalid'
    return 'unknown'
  }

  const getItemValidationReason = (itemId: string): string | null => {
    if (!validationResult) return null
    const invalid = validationResult.invalid_links.find(inv => inv.child_id === itemId)
    if (!invalid) return null

    switch (invalid.reason) {
      case 'self_link':
        return 'Cannot link item to itself'
      case 'circular':
        return 'Would create circular dependency'
      case 'not_found':
        return 'Item not found'
      case 'cross_user':
        return 'Cannot link items from different users'
      case 'max_limit':
        return 'Maximum child limit (20) reached'
      default:
        return 'Invalid link'
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-3">Loading linkable items...</span>
          </div>
        </div>
      </div>
    )
  }

  const groupedItems = groupItemsByList(linkableItems)
  const hasInvalidSelections = validationResult && validationResult.invalid_links.length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="text-green-600 mr-2">↓</span>
            Link Child Items
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            When "{parentItem.content}" is completed, these child items will automatically complete
          </p>
          {currentChildren.length > 0 && (
            <p className="text-xs text-green-600 mt-1">
              Currently has {currentChildren.length} child item(s)
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {validationResult && validationResult.warnings.length > 0 && (
            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md mb-4">
              <p className="font-medium text-sm">Warnings:</p>
              <ul className="list-disc list-inside text-xs mt-1">
                {validationResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No items available to link as children.</p>
              <p className="text-sm mt-2">Create items in other lists to link them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([listName, items]) => (
                <div key={listName} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">{listName}</h4>
                  <div className="space-y-2">
                    {items.map(item => {
                      const validationStatus = getItemValidationStatus(item.id)
                      const validationReason = getItemValidationReason(item.id)
                      const isSelected = selectedItems.includes(item.id)
                      const isDisabled = validationStatus === 'invalid' && !isSelected

                      return (
                        <label
                          key={item.id}
                          className={`flex items-center space-x-3 ${
                            isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleItemToggle(item.id)}
                            disabled={isDisabled}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className={`flex-1 ${item.is_completed ? 'line-through text-gray-500' : ''}`}>
                            {item.content}
                          </span>
                          {item.is_completed && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              Completed
                            </span>
                          )}
                          {validationStatus === 'invalid' && validationReason && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                              {validationReason}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-6 flex justify-between">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex space-x-3 items-center">
            <div className="text-sm text-gray-500">
              {selectedItems.length} / 20 children selected
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving || selectedItems.length > 20 || (hasInvalidSelections && selectedItems.some(id => getItemValidationStatus(id) === 'invalid'))}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Child Links'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}