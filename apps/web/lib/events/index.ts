/**
 * Commerce Events Module
 *
 * Proactive event system for cart recovery and merchant notifications.
 * Uses polling pattern (NOT pg_notify) for Azure PostgreSQL free tier compatibility.
 *
 * @module @/lib/events
 */

export * from "./trigger";
export * from "./poller";
