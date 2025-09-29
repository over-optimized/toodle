import { useState, useEffect } from 'react'
import { linkingService } from '../../services'
import type { Item } from '../../types'

interface LinkSuggestionsProps {
  sourceItem: Item
  onSuggestionApplied: () => void
  onClose: () => void
}

interface SuggestedLink {
  item: Item
  score: number
  reason: string
}

export function LinkSuggestions({ sourceItem, onSuggestionApplied, onClose }: LinkSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestedLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyingLinks, setApplyingLinks] = useState<Set<string>>(new Set())

  useEffect(() => {
    generateSuggestions()
  }, [sourceItem.id])

  const generateSuggestions = async () => {
    setIsLoading(true)
    setError('')

    try {
      // Get all linkable items
      const result = await linkingService.getLinkableItems(sourceItem.id)

      if (result.error) {
        setError(result.error)
        return
      }

      const linkableItems = result.data || []
      const suggestedLinks = findSimilarItems(sourceItem, linkableItems)

      setSuggestions(suggestedLinks.slice(0, 10)) // Top 10 suggestions
    } catch (err) {
      setError('Failed to generate suggestions')
    } finally {
      setIsLoading(false)
    }
  }

  const findSimilarItems = (source: Item, candidates: Item[]): SuggestedLink[] => {
    const suggestions: SuggestedLink[] = []
    const sourceContent = source.content.toLowerCase()
    const sourceWords = sourceContent.split(/\s+/).filter(word => word.length > 2)

    candidates.forEach(candidate => {
      const candidateContent = candidate.content.toLowerCase()
      const candidateWords = candidateContent.split(/\s+/).filter(word => word.length > 2)

      let score = 0
      const reasons: string[] = []

      // Exact phrase matching
      if (candidateContent.includes(sourceContent) || sourceContent.includes(candidateContent)) {
        score += 50
        reasons.push('contains similar phrase')
      }

      // Word overlap scoring
      const commonWords = sourceWords.filter(word => candidateWords.includes(word))
      if (commonWords.length > 0) {
        score += (commonWords.length / Math.max(sourceWords.length, candidateWords.length)) * 30
        reasons.push(`${commonWords.length} common word(s)`)
      }

      // Category-based suggestions for grocery lists
      const listInfo = (candidate as any).lists
      if (listInfo?.type === 'grocery') {
        const groceryKeywords = ['recipe', 'meal', 'cook', 'ingredient', 'dish']
        if (groceryKeywords.some(keyword => sourceContent.includes(keyword))) {
          score += 20
          reasons.push('meal-grocery connection')
        }
      }

      // Cross-list type suggestions
      if (source.list_id !== candidate.list_id) {
        const sourceListType = sourceContent.includes('shop') ? 'action' : 'item'
        if (sourceListType === 'action' && listInfo?.type === 'grocery') {
          score += 15
          reasons.push('action-grocery connection')
        }
      }

      // Deadline-based suggestions for countdown lists
      if (listInfo?.type === 'countdown' && source.target_date && candidate.target_date) {
        const sourceDue = new Date(source.target_date)
        const candidateDue = new Date(candidate.target_date)
        const daysDiff = Math.abs(sourceDue.getTime() - candidateDue.getTime()) / (1000 * 60 * 60 * 24)

        if (daysDiff <= 7) {
          score += 25
          reasons.push('similar deadline')
        }
      }

      // Completion status similarity
      if (source.is_completed === candidate.is_completed && !source.is_completed) {
        score += 10
        reasons.push('both pending')
      }

      // Only include items with meaningful similarity
      if (score > 15) {
        suggestions.push({
          item: candidate,
          score: Math.round(score),
          reason: reasons.join(', ')
        })
      }
    })

    // Sort by score descending
    return suggestions.sort((a, b) => b.score - a.score)
  }

  const handleApplySuggestion = async (targetItem: Item) => {
    setApplyingLinks(prev => new Set(prev).add(targetItem.id))

    try {
      const result = await linkingService.addLinks(sourceItem.id, [targetItem.id])

      if (result.error) {
        setError(`Failed to add link: ${result.error}`)
        return
      }

      // Remove applied suggestion from list
      setSuggestions(prev => prev.filter(s => s.item.id !== targetItem.id))
      onSuggestionApplied()
    } catch (err) {
      setError('Failed to apply suggestion')
    } finally {
      setApplyingLinks(prev => {
        const newSet = new Set(prev)
        newSet.delete(targetItem.id)
        return newSet
      })
    }
  }

  const handleApplyAllSuggestions = async () => {
    const targetIds = suggestions.map(s => s.item.id)

    try {
      const result = await linkingService.addLinks(sourceItem.id, targetIds)

      if (result.error) {
        setError(`Failed to apply all suggestions: ${result.error}`)
        return
      }

      setSuggestions([])
      onSuggestionApplied()
      onClose()
    } catch (err) {
      setError('Failed to apply all suggestions')
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Generating suggestions...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Smart Link Suggestions</h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-suggested links for "{sourceItem.content}"
          </p>
          {suggestions.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Found {suggestions.length} potential link(s)
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {suggestions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-4">🤖</div>
              <p>No smart suggestions found.</p>
              <p className="text-sm mt-2">
                The AI couldn't find items that are likely to be related to this item.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(suggestion => {
                const listInfo = (suggestion.item as any).lists
                const isApplying = applyingLinks.has(suggestion.item.id)

                return (
                  <div key={suggestion.item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={suggestion.item.is_completed ? 'line-through text-gray-500' : ''}>
                            {suggestion.item.content}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {suggestion.score}% match
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          in {listInfo.title} ({listInfo.type})
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Suggested because: {suggestion.reason}
                        </div>
                        {suggestion.item.is_completed && (
                          <div className="text-xs text-gray-500 mt-1">
                            Item is completed
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleApplySuggestion(suggestion.item)}
                        disabled={isApplying}
                        className="ml-3 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                      >
                        {isApplying && (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        )}
                        {isApplying ? 'Adding...' : 'Add Link'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t p-6 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
          {suggestions.length > 0 && (
            <div className="flex space-x-3">
              <button
                onClick={handleApplyAllSuggestions}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Apply All ({suggestions.length})
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}