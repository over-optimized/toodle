import { useState, useEffect } from 'react'
import { linkingService } from '../../services'
import type { Item, LinkedItemInfo } from '../../types'

interface ItemLinkerProps {
  sourceItem: Item
  onLinksUpdated: () => void
  onClose: () => void
}

export function ItemLinker({ sourceItem, onLinksUpdated, onClose }: ItemLinkerProps) {
  const [linkableItems, setLinkableItems] = useState<Item[]>([])
  const [currentLinks, setCurrentLinks] = useState<LinkedItemInfo[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [sourceItem.id])

  const loadData = async () => {
    setIsLoading(true)
    setError('')

    try {
      const [linkableResult, currentLinksResult] = await Promise.all([
        linkingService.getLinkableItems(sourceItem.id),
        linkingService.getLinkedItemsInfo(sourceItem.id)
      ])

      if (linkableResult.error) {
        setError(`Failed to load linkable items: ${linkableResult.error}`)
        return
      }

      if (currentLinksResult.error) {
        setError(`Failed to load current links: ${currentLinksResult.error}`)
        return
      }

      setLinkableItems(linkableResult.data || [])
      setCurrentLinks(currentLinksResult.data || [])
      setSelectedItems(currentLinksResult.data?.map(item => item.id) || [])
    } catch (err) {
      setError('Failed to load linking data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSave = async () => {
    setError('')

    try {
      const result = await linkingService.replaceLinks(sourceItem.id, selectedItems)

      if (result.error) {
        setError(`Failed to update links: ${result.error}`)
        return
      }

      onLinksUpdated()
      onClose()
    } catch (err) {
      setError('Failed to save links')
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Loading linkable items...</span>
          </div>
        </div>
      </div>
    )
  }

  const groupedItems = groupItemsByList(linkableItems)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Link Items</h3>
          <p className="text-sm text-gray-600 mt-1">
            Link "{sourceItem.content}" to items from other lists
          </p>
          {currentLinks.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Currently linked to {currentLinks.length} item(s)
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No items available to link.</p>
              <p className="text-sm mt-2">Create items in other lists to link them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([listName, items]) => (
                <div key={listName} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">{listName}</h4>
                  <div className="space-y-2">
                    {items.map(item => (
                      <label key={item.id} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => handleItemToggle(item.id)}
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
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <div className="flex space-x-3">
            <div className="text-sm text-gray-500 self-center">
              {selectedItems.length} / 50 items selected
            </div>
            <button
              onClick={handleSave}
              disabled={selectedItems.length > 50}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save Links
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}