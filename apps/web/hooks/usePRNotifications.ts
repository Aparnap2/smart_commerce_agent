'use client'

import { useState, useEffect, useCallback } from 'react'

interface PRNotification {
  id: string
  prId: string
  prNumber: string
  type: 'PR_SUBMITTED' | 'PR_APPROVED' | 'PR_REJECTED' | 'PR_NEEDS_REVISION'
  message: string
  amount?: number
  timestamp: string
  read: boolean
}

export function usePRNotifications() {
  const [notifications, setNotifications] = useState<PRNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/seen')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount((data.notifications || []).filter((n: PRNotification) => !n.read).length)
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const subscribe = useCallback(async (employeeId: string) => {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    })
  }, [])

  const markSeen = useCallback(async (notificationIds: string[]) => {
    await fetch('/api/notifications/seen', {
      method: 'POST',
      body: JSON.stringify({ notificationIds }),
    })
    await fetchNotifications()
  }, [fetchNotifications])

  const deliverNotification = useCallback(async (payload: {
    prId: string
    prNumber: string
    employeeId: string
    type: PRNotification['type']
    message: string
    amount?: number
  }) => {
    await fetch('/api/notifications/deliver', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  return {
    notifications,
    loading,
    unreadCount,
    subscribe,
    markSeen,
    deliverNotification,
    refetch: fetchNotifications,
  }
}