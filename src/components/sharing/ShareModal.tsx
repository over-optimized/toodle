import { useState } from 'react'
import { useShareMutations } from '../../hooks'
import type { List } from '../../types'

interface ShareModalProps {
  list: List
  isOpen: boolean
  onClose: () => void
}

export function ShareModal({ list, isOpen, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'read' | 'write'>('read')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const { createShare } = useShareMutations(list.id)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setError('')
    setSuccess('')

    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

      await createShare.mutateAsync({
        shared_with_email: email.trim(),
        permission,
        expires_at: expiresAt.toISOString()
      })

      setSuccess(`List shared with ${email}!`)
      setEmail('')

      // Generate shareable link (could be enhanced to use actual share ID)
      const link = `${window.location.origin}/shared/${list.id}?permission=${permission}`
      setShareLink(link)
    } catch (error) {
      setError('Failed to share list. Please try again.')
    }
  }

  const copyToClipboard = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Share "{list.title}"
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
              disabled={createShare.isPending}
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
                  name="permission"
                  value="read"
                  checked={permission === 'read'}
                  onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
                  className="mr-2"
                  disabled={createShare.isPending}
                />
                <span className="text-sm">View only - can see items but not edit</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="permission"
                  value="write"
                  checked={permission === 'write'}
                  onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
                  className="mr-2"
                  disabled={createShare.isPending}
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

          {shareLink && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Shareable link
              </label>
              <div className="flex rounded-md shadow-sm">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 text-sm bg-gray-50"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {copySuccess ? '✓' : '📋'}
                </button>
              </div>
              {copySuccess && (
                <p className="text-sm text-green-600">Link copied to clipboard!</p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              disabled={createShare.isPending}
            >
              Close
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={createShare.isPending}
            >
              {createShare.isPending ? 'Sharing...' : 'Share List'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Share expires in 7 days
        </div>
      </div>
    </div>
  )
}