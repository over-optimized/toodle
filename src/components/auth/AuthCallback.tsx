import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores'

export function AuthCallback() {
  const navigate = useNavigate()
  const { initialize } = useAuthStore()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        await initialize()
        navigate('/', { replace: true })
      } catch (error) {
        console.error('Auth callback error:', error)
        navigate('/login', { replace: true })
      }
    }

    handleAuthCallback()
  }, [initialize, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  )
}