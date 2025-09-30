import { useEffect, useState } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning' | 'propagation'
  message: string
  duration?: number
}

/**
 * Toast Notification System
 * Listens to custom events from hooks and displays notifications
 * Supports link operations, propagation events, and general feedback
 */
export function ToastNotification() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Listen for link operation notifications
    const handleLinkNotification = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const type =
        detail.type === 'link-error' ? 'error' :
        detail.type === 'link-removed' || detail.type === 'link-created' || detail.type === 'bulk-links-created' ? 'success' :
        'info'

      addToast({
        type,
        message: detail.message,
        duration: 3000,
      })
    }

    // Listen for propagation notifications
    const handlePropagationNotification = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const type =
        detail.type === 'propagation-error' ? 'error' :
        detail.type === 'status-propagated' || detail.type === 'background-propagation' ? 'propagation' :
        'info'

      addToast({
        type,
        message: detail.message,
        duration: detail.type === 'status-propagated' ? 4000 : 3000, // Longer for propagation
      })
    }

    // Listen for realtime notifications
    const handleRealtimeNotification = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const type =
        detail.type === 'status-propagated' ? 'propagation' :
        detail.type === 'links-updated' ? 'success' :
        'info'

      addToast({
        type,
        message: detail.message,
        duration: 3000,
      })
    }

    window.addEventListener('link-notification', handleLinkNotification)
    window.addEventListener('propagation-notification', handlePropagationNotification)
    window.addEventListener('realtime-notification', handleRealtimeNotification)

    return () => {
      window.removeEventListener('link-notification', handleLinkNotification)
      window.removeEventListener('propagation-notification', handlePropagationNotification)
      window.removeEventListener('realtime-notification', handleRealtimeNotification)
    }
  }, [])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    const newToast = { ...toast, id }

    setToasts((prev) => [...prev, newToast])

    // Auto-remove after duration
    setTimeout(() => {
      removeToast(id)
    }, toast.duration || 3000)
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-out animate-slide-in-right ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            toast.type === 'warning' ? 'bg-yellow-600 text-white' :
            toast.type === 'propagation' ? 'bg-purple-600 text-white' :
            'bg-blue-600 text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              {toast.type === 'success' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {toast.type === 'propagation' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-5">{toast.message}</p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 ml-2 inline-flex text-white hover:text-gray-200 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Slide-in animation */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

/**
 * Programmatic toast API
 * Can be used to show toasts from anywhere in the app
 */
export const showToast = {
  success: (message: string) => {
    window.dispatchEvent(
      new CustomEvent('link-notification', {
        detail: { type: 'success', message },
      })
    )
  },
  error: (message: string) => {
    window.dispatchEvent(
      new CustomEvent('link-notification', {
        detail: { type: 'link-error', message },
      })
    )
  },
  info: (message: string) => {
    window.dispatchEvent(
      new CustomEvent('realtime-notification', {
        detail: { type: 'info', message },
      })
    )
  },
  propagation: (message: string, affectedCount?: number) => {
    window.dispatchEvent(
      new CustomEvent('propagation-notification', {
        detail: {
          type: 'status-propagated',
          message,
          affectedCount,
        },
      })
    )
  },
}