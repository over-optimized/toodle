import { useState, useEffect } from 'react'
import { linkingService } from '../../services'
import type { Item } from '../../types'

interface QuickLinkAddProps {
  sourceItemId: string
  onLinkAdded: () => void
  onClose: () => void
}

export function QuickLinkAdd({ sourceItemId, onLinkAdded, onClose }: QuickLinkAddProps) {
  const [linkableItems, setLinkableItems] = useState<Item[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLinkableItems()
  }, [sourceItemId])

  const loadLinkableItems = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await linkingService.getLinkableItems(sourceItemId)

      if (result.error) {
        setError(result.error)
        return
      }

      setLinkableItems(result.data || [])
    } catch (err) {
      setError('Failed to load items')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLink = async (targetItemId: string) => {
    try {
      const result = await linkingService.addLinks(sourceItemId, [targetItemId])

      if (result.error) {
        setError(result.error)
        return
      }

      onLinkAdded()
      onClose()
    } catch (err) {
      setError('Failed to add link')
    }
  }

  const filteredItems = linkableItems.filter(item =>
    item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item as any).lists?.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedItems = filteredItems.reduce((groups, item) => {
    const listInfo = (item as any).lists
    const listKey = `${listInfo.title} (${listInfo.type})`

    if (!groups[listKey]) {
      groups[listKey] = []
    }
    groups[listKey].push(item)
    return groups
  }, {} as Record<string, Item[]>)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[60vh] flex flex-col">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Quick Add Link</h3>
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3">Loading...</span>
            </div>
          ) : Object.keys(groupedItems).length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p>No items found</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedItems).map(([listName, items]) => (
                <div key={listName}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">{listName}</h4>
                  <div className="space-y-1">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => handleAddLink(item.id)}
                        className="w-full text-left p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200"
                      >
                        <div className={`${item.is_completed ? 'line-through text-gray-500' : ''}`}>
                          {item.content}
                        </div>
                        {item.is_completed && (
                          <div className="text-xs text-green-600 mt-1">Completed</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}