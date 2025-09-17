import { useState } from 'react'
import { apiService } from '../../services/api'
import type { ShareRole } from '../../types'

interface ShareModalProps {
  listId: string
  listTitle: string
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ listId, listTitle, isOpen, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ShareRole>('read')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
      
      const { error } = await apiService.createShare(listId, {
        shared_with_email: email.trim(),
        role,
        expires_at: expiresAt.toISOString()
      })
      
      if (error) {
        setError(error)
      } else {
        setSuccess(`List shared with ${email}!`)
        setEmail('')
      }
    } catch (err) {
      setError('Failed to share list. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Share "{listTitle}"
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email to share with"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permission level
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="read"
                  checked={role === 'read'}
                  onChange={(e) => setRole(e.target.value as ShareRole)}
                  className="mr-2"
                  disabled={isLoading}
                />
                <span className="text-sm">View only - can see items but not edit</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="edit"
                  checked={role === 'edit'}
                  onChange={(e) => setRole(e.target.value as ShareRole)}
                  className="mr-2"
                  disabled={isLoading}
                />
                <span className="text-sm">Edit access - can add and modify items</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
              {success}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={isLoading}
            >
              Close
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Sharing...' : 'Share List'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Share expires in 24 hours
        </div>
      </div>
    </div>
  )
}