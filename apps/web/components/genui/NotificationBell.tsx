// NotificationBell — GenUI component for notification display
//
// Renders a bell icon with an unread count badge in the app header.
// Clicking opens a dropdown panel showing recent notifications with
// read/unread visual distinction, relative timestamps, and action buttons.
//
// States: loading | error | empty | populated | all-read
// Edge cases: 99+ count, missing createdAt, missing link, long titles,
//   null/undefined notifications, empty array, all-items-read,
//   malformed notification items, keyboard navigation.

'use client'

import React, { useState, useEffect, useRef, type FC, useCallback } from 'react'
import { Bell } from 'lucide-react'
import type { NotificationBellProps, NotificationItem } from '@/lib/ui-event-types'
import { safeString, safeArray, safeDate } from '@/lib/genui/safe-render'

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Recently'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Recently'
    const now = Date.now()
    const then = d.getTime()
    const diffMs = now - then

    // If the timestamp is in the future, show 'Just now'
    if (diffMs < 0) return 'Just now'

    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Just now'

    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} min ago`

    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`

    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`

    // Older than a week — show date
    return safeDate(iso)
  } catch {
    return 'Recently'
  }
}

// ---------------------------------------------------------------------------
// Type icon mapping
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, string> = {
  pr_submitted: '📋',
  pr_approved: '✅',
  pr_rejected: '❌',
  budget_alert: '⚠️',
  sourcing_update: '📦',
  dispute_raised: '🚨',
}

function getTypeIcon(type: string): string {
  return TYPE_ICONS[type] ?? '🔔'
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton: FC = () => (
  <div
    data-testid="notification-bell-skeleton"
    className="relative inline-flex animate-pulse"
    role="status"
    aria-label="Loading notifications"
  >
    <div className="w-9 h-9 bg-gray-100 rounded-lg" />
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div
    data-testid="notification-bell-error"
    className="relative inline-flex"
    role="alert"
  >
    <button
      className="relative p-2 rounded-lg bg-red-50 text-red-400 cursor-default"
      aria-label="Notifications unavailable"
      disabled
    >
      <Bell size={20} />
    </button>
    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-red-200 rounded-xl shadow-lg p-3 z-50">
      <p className="text-red-700 font-medium text-xs">Unable to load notifications</p>
      <p className="text-red-500 text-xs mt-0.5">{message}</p>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState: FC = () => (
  <div
    data-testid="notification-bell-empty"
    className="flex flex-col items-center justify-center py-10 text-center px-4"
  >
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
      <Bell size={22} className="text-gray-300" />
    </div>
    <p className="text-gray-500 font-medium text-sm">No notifications yet</p>
    <p className="text-gray-400 text-xs mt-1">We&apos;ll notify you when something arrives</p>
  </div>
)

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const NotificationBell: FC<NotificationBellProps> = ({
  count,
  notifications,
  loading = false,
  error = null,
  onMarkRead,
  onMarkAllRead,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Safe data
  const safeNotifications = safeArray<NotificationItem>(notifications)
  const derivedUnread = safeNotifications.filter((n) => !n.read).length
  const displayUnread = count ?? derivedUnread
  const displayBadge = displayUnread > 99 ? '99+' : displayUnread > 0 ? String(displayUnread) : null
  const allRead = safeNotifications.length > 0 && derivedUnread === 0
  const hasNotifications = safeNotifications.length > 0

  // ── Outside click handler ─────────────────────────────────────────────
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsOpen(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleClickOutside, handleEscape])

  // ── Toggle dropdown ───────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  // ── Handle mark read ──────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    (id: string) => {
      onMarkRead?.(id)
    },
    [onMarkRead],
  )

  const handleMarkAllRead = useCallback(() => {
    onMarkAllRead?.()
  }, [onMarkAllRead])

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Rendered ──────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="relative inline-flex" data-testid="notification-bell">
      {/* ── Bell button ─────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
        aria-label={`Notifications: ${displayUnread} unread`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid="notification-bell-btn"
      >
        <Bell size={20} aria-hidden="true" />

        {/* Badge */}
        {displayBadge && (
          <span
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white"
            aria-label={`${displayUnread} unread notification${displayUnread !== 1 ? 's' : ''}`}
          >
            {displayBadge}
          </span>
        )}
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          role="menu"
          aria-label="Notifications"
          data-testid="notification-dropdown"
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            <button
              onClick={handleMarkAllRead}
              disabled={!hasNotifications || allRead}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                !hasNotifications || allRead
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100'
              }`}
              aria-label="Mark all notifications as read"
              data-testid="mark-all-read-btn"
            >
              Mark all as read
            </button>
          </div>

          {/* ── List ────────────────────────────────────────────────── */}
          {!hasNotifications ? (
            <EmptyState />
          ) : (
            <ul className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto" role="list">
              {safeNotifications.map((notification) => {
                const itemTitle = safeString(notification.title, 'Notification')
                const itemMessage = safeString(notification.message)
                const itemTime = relativeTime(notification.createdAt)
                const typeIcon = getTypeIcon(notification.type)
                const hasLink = !!notification.link

                return (
                  <li
                    key={notification.id}
                    role="menuitem"
                    data-testid={`notification-item-${notification.id}`}
                    data-read={notification.read ? 'true' : 'false'}
                  >
                    <button
                      onClick={() => {
                        handleMarkRead(notification.id)
                        if (hasLink && notification.link) {
                          // Allow link navigation via the consumer
                          window.open(notification.link, '_blank', 'noopener,noreferrer')
                        }
                      }}
                      className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                        notification.read
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-indigo-50/30 hover:bg-indigo-50'
                      }`}
                    >
                      {/* Type icon */}
                      <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">
                        {typeIcon}
                      </span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        {/* Title */}
                        <p
                          className={`text-sm truncate ${
                            notification.read
                              ? 'text-gray-700 font-normal'
                              : 'text-gray-900 font-semibold'
                          }`}
                          title={itemTitle}
                        >
                          {!notification.read && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 align-middle shrink-0" aria-hidden="true" />
                          )}
                          {itemTitle}
                        </p>

                        {/* Message */}
                        {itemMessage && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {itemMessage}
                          </p>
                        )}

                        {/* Time */}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {itemTime}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
