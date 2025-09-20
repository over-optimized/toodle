import { useState, useEffect, useRef } from 'react'
import { realtimeManager, type RealtimeSubscription } from '../lib/realtime'
import { useAuthStore } from '../stores'

export interface PresenceUser {
  user_id: string
  email: string
  display_name?: string
  cursor_position?: { x: number; y: number }
  last_seen?: string
  online_at: string
  color?: string
}

export interface PresenceState {
  [key: string]: PresenceUser[]
}

const PRESENCE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

export function usePresence(listId: string | null) {
  const { user } = useAuthStore()
  const [presenceState, setPresenceState] = useState<PresenceState>({})
  const [isTracking, setIsTracking] = useState(false)
  const subscriptionsRef = useRef<RealtimeSubscription[]>([])
  const colorAssignments = useRef<Map<string, string>>(new Map())

  // Assign colors to users consistently
  const assignColor = (userId: string): string => {
    if (!colorAssignments.current.has(userId)) {
      const usedColors = Array.from(colorAssignments.current.values())
      const availableColors = PRESENCE_COLORS.filter(color => !usedColors.includes(color))
      const color = availableColors[0] || PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)]
      colorAssignments.current.set(userId, color)
    }
    return colorAssignments.current.get(userId)!
  }

  const startTracking = () => {
    if (!listId || !user || isTracking) {
      return
    }

    // Track current user's presence
    const trackingSubscription = realtimeManager.trackPresence(listId, {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name || user.email.split('@')[0],
      last_seen: new Date().toISOString()
    })

    // Subscribe to presence changes
    const presenceSubscription = realtimeManager.subscribeToPresence(listId, {
      onJoin: (key, currentPresences, newPresences) => {
        console.log('User joined:', key, newPresences)
        updatePresenceState()
      },
      onLeave: (key, currentPresences, leftPresences) => {
        console.log('User left:', key, leftPresences)
        updatePresenceState()
      },
      onSync: () => {
        console.log('Presence synced')
        updatePresenceState()
      }
    })

    subscriptionsRef.current = [trackingSubscription, presenceSubscription]
    setIsTracking(true)

    // Update presence state immediately
    setTimeout(updatePresenceState, 100)
  }

  const stopTracking = () => {
    subscriptionsRef.current.forEach(sub => sub.unsubscribe())
    subscriptionsRef.current = []
    setIsTracking(false)
    setPresenceState({})
  }

  const updatePresenceState = () => {
    if (!listId) return

    const state = realtimeManager.getPresenceState(listId)

    // Add colors to users
    const stateWithColors: PresenceState = {}
    for (const [key, presences] of Object.entries(state)) {
      stateWithColors[key] = presences.map(presence => ({
        ...presence,
        color: assignColor(presence.user_id)
      }))
    }

    setPresenceState(stateWithColors)
  }

  const updateCursorPosition = (x: number, y: number) => {
    if (!listId || !user || !isTracking) return

    // Update cursor position in presence
    const channel = realtimeManager.getPresenceState(listId)
    if (channel) {
      realtimeManager.trackPresence(listId, {
        user_id: user.id,
        email: user.email,
        display_name: user.display_name || user.email.split('@')[0],
        cursor_position: { x, y },
        last_seen: new Date().toISOString()
      })
    }
  }

  const updateLastSeen = () => {
    if (!listId || !user || !isTracking) return

    realtimeManager.trackPresence(listId, {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name || user.email.split('@')[0],
      last_seen: new Date().toISOString()
    })
  }

  // Auto-start tracking when listId and user are available
  useEffect(() => {
    if (listId && user && !isTracking) {
      startTracking()
    }

    return () => {
      if (isTracking) {
        stopTracking()
      }
    }
  }, [listId, user?.id])

  // Update last seen every 30 seconds
  useEffect(() => {
    if (!isTracking) return

    const interval = setInterval(updateLastSeen, 30000)
    return () => clearInterval(interval)
  }, [isTracking])

  // Get list of other users (excluding current user)
  const otherUsers = Object.values(presenceState)
    .flat()
    .filter(presence => presence.user_id !== user?.id)

  // Get current user's presence
  const currentUserPresence = Object.values(presenceState)
    .flat()
    .find(presence => presence.user_id === user?.id)

  // Get count of online users
  const onlineCount = Object.values(presenceState).flat().length

  return {
    presenceState,
    otherUsers,
    currentUserPresence,
    onlineCount,
    isTracking,
    startTracking,
    stopTracking,
    updateCursorPosition,
    updateLastSeen
  }
}

export function useCollaborativeCursor(listId: string | null) {
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number; user: PresenceUser }>>(new Map())
  const { presenceState } = usePresence(listId)

  useEffect(() => {
    const newCursors = new Map<string, { x: number; y: number; user: PresenceUser }>()

    Object.values(presenceState).flat().forEach(user => {
      if (user.cursor_position) {
        newCursors.set(user.user_id, {
          x: user.cursor_position.x,
          y: user.cursor_position.y,
          user
        })
      }
    })

    setCursors(newCursors)
  }, [presenceState])

  return cursors
}

export function useBroadcast(listId: string | null) {
  const [subscriptions, setSubscriptions] = useState<Map<string, RealtimeSubscription>>(new Map())

  const broadcast = async (event: string, payload: any) => {
    if (!listId) return 'timed_out' as const

    return realtimeManager.broadcast(listId, event, payload)
  }

  const subscribe = (event: string, callback: (payload: any) => void) => {
    if (!listId) return () => {}

    const subscription = realtimeManager.subscribeToBroadcast(listId, event, callback)

    setSubscriptions(prev => {
      const newSubs = new Map(prev)
      newSubs.set(event, subscription)
      return newSubs
    })

    return () => {
      subscription.unsubscribe()
      setSubscriptions(prev => {
        const newSubs = new Map(prev)
        newSubs.delete(event)
        return newSubs
      })
    }
  }

  const unsubscribeAll = () => {
    subscriptions.forEach(sub => sub.unsubscribe())
    setSubscriptions(new Map())
  }

  useEffect(() => {
    return () => {
      unsubscribeAll()
    }
  }, [listId])

  return {
    broadcast,
    subscribe,
    unsubscribeAll,
    activeSubscriptions: subscriptions.size
  }
}