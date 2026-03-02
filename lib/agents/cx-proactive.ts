/**
 * Proactive Customer Experience Agent
 *
 * Monitors and triggers proactive customer engagement based on:
 * - Cart abandonment
 * - Price drops on watched items
 * - Order delays
 * - Support ticket escalations
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';
import { getRedisClient } from '../redis/client.js';
import type { Redis } from 'ioredis';

/**
 * Proactive trigger types
 */
export type TriggerType =
  | 'cart_abandonment'
  | 'price_drop'
  | 'order_delay'
  | 'ticket_escalation'
  | 'restock_alert'
  | 'personalized_offer';

/**
 * Proactive trigger event
 */
export interface ProactiveTrigger {
  id: string;
  type: TriggerType;
  userId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: Record<string, unknown>;
  createdAt: number;
  scheduledFor?: number;
  status: 'pending' | 'sent' | 'dismissed' | 'expired';
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  /** Cart abandonment delay in minutes */
  cartAbandonmentDelay: number;
  /** Price drop threshold percentage */
  priceDropThreshold: number;
  /** Order delay threshold in hours */
  orderDelayThreshold: number;
  /** Enable email notifications */
  enableEmail: boolean;
  /** Enable in-app notifications */
  enableInApp: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TriggerConfig = {
  cartAbandonmentDelay: 60, // 1 hour
  priceDropThreshold: 10, // 10% drop
  orderDelayThreshold: 24, // 24 hours
  enableEmail: true,
  enableInApp: true,
};

/**
 * Proactive CX Manager
 */
export class ProactiveCXManager {
  private redis: Redis;
  private config: TriggerConfig;
  private pollInterval: NodeJS.Timeout | null;

  constructor(config: Partial<TriggerConfig> = {}) {
    this.redis = getRedisClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pollInterval = null;
  }

  /**
   * Initialize and start polling
   */
  async initialize(): Promise<void> {
    logger.info('RAG', 'ProactiveCXManager initialized', {
      config: this.config,
    });

    // Start polling for triggers
    this.startPolling();
  }

  /**
   * Start polling for pending triggers
   */
  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      await this.processPendingTriggers();
    }, 30000); // Poll every 30 seconds

    logger.debug('RAG', 'ProactiveCXManager polling started');
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.debug('RAG', 'ProactiveCXManager polling stopped');
  }

  /**
   * Create a new trigger
   */
  async createTrigger(
    type: TriggerType,
    userId: string,
    data: Record<string, unknown>,
    priority: ProactiveTrigger['priority'] = 'medium',
    delayMinutes?: number
  ): Promise<string> {
    const triggerId = `trigger:${Date.now()}:${userId}:${type}`;
    const now = Date.now();

    const trigger: ProactiveTrigger = {
      id: triggerId,
      type,
      userId,
      priority,
      data,
      createdAt: now,
      scheduledFor: delayMinutes ? now + delayMinutes * 60 * 1000 : undefined,
      status: 'pending',
    };

    // Store in Redis
    await this.redis.hset(`triggers:${userId}`, triggerId, JSON.stringify(trigger));

    // Add to sorted set for time-based retrieval
    if (trigger.scheduledFor) {
      await this.redis.zadd('trigger_schedule', trigger.scheduledFor, triggerId);
    } else {
      await this.redis.zadd('trigger_schedule', now, triggerId);
    }

    logger.info('RAG', 'Trigger created', {
      triggerId,
      type,
      userId,
      priority,
      scheduledFor: trigger.scheduledFor,
    });

    return triggerId;
  }

  /**
   * Process pending triggers
   */
  private async processPendingTriggers(): Promise<void> {
    const now = Date.now();

    // Get triggers that are due
    const dueTriggerIds = await this.redis.zrangebyscore(
      'trigger_schedule',
      0,
      now.toString()
    );

    if (dueTriggerIds.length === 0) {
      return;
    }

    logger.debug('RAG', 'Processing pending triggers', {
      count: dueTriggerIds.length,
    });

    for (const triggerId of dueTriggerIds) {
      try {
        // Extract userId from triggerId
        const parts = triggerId.split(':');
        const userId = parts[2];

        const triggerData = await this.redis.hget(`triggers:${userId}`, triggerId);
        if (!triggerData) {
          continue;
        }

        const trigger = JSON.parse(triggerData) as ProactiveTrigger;

        // Process based on type
        await this.processTrigger(trigger);

        // Mark as sent
        trigger.status = 'sent';
        await this.redis.hset(`triggers:${userId}`, triggerId, JSON.stringify(trigger));
        await this.redis.zrem('trigger_schedule', triggerId);
      } catch (error) {
        logger.error('RAG', 'Error processing trigger', error);
      }
    }
  }

  /**
   * Process a single trigger
   */
  private async processTrigger(trigger: ProactiveTrigger): Promise<void> {
    logger.info('RAG', 'Processing trigger', {
      type: trigger.type,
      userId: trigger.userId,
      priority: trigger.priority,
    });

    switch (trigger.type) {
      case 'cart_abandonment':
        await this.handleCartAbandonment(trigger);
        break;
      case 'price_drop':
        await this.handlePriceDrop(trigger);
        break;
      case 'order_delay':
        await this.handleOrderDelay(trigger);
        break;
      case 'ticket_escalation':
        await this.handleTicketEscalation(trigger);
        break;
      case 'restock_alert':
        await this.handleRestockAlert(trigger);
        break;
      case 'personalized_offer':
        await this.handlePersonalizedOffer(trigger);
        break;
    }
  }

  /**
   * Handle cart abandonment trigger
   */
  private async handleCartAbandonment(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { cartValue, itemCount, cartId } = data;

    logger.info('RAG', 'Cart abandonment detected', {
      userId,
      cartValue,
      itemCount,
    });

    // Create personalized message
    const message = `Hi! You left ${itemCount} item(s) in your cart (worth $${cartValue}). 
Complete your purchase now and get free shipping on orders over $50!`;

    // Send notification
    await this.sendNotification(userId, {
      type: 'cart_abandonment',
      title: 'Don\'t forget your items!',
      message,
      actionUrl: `/cart/${cartId}`,
      priority: trigger.priority,
    });
  }

  /**
   * Handle price drop trigger
   */
  private async handlePriceDrop(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { productId, productName, oldPrice, newPrice, dropPercent } = data;

    logger.info('RAG', 'Price drop alert', {
      userId,
      productName,
      oldPrice,
      newPrice,
      dropPercent,
    });

    const message = `Great news! ${productName} is now ${dropPercent}% off. 
Was $${oldPrice}, now only $${newPrice}!`;

    await this.sendNotification(userId, {
      type: 'price_drop',
      title: 'Price Drop Alert!',
      message,
      actionUrl: `/product/${productId}`,
      priority: 'high',
    });
  }

  /**
   * Handle order delay trigger
   */
  private async handleOrderDelay(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { orderId, expectedDate, newDate, reason } = data;

    logger.warn('RAG', 'Order delay notification', {
      userId,
      orderId,
      expectedDate,
      newDate,
    });

    const message = `We're sorry, but your order #${orderId} will be delayed. 
New expected delivery: ${newDate}. Reason: ${reason}. 
We apologize for the inconvenience.`;

    await this.sendNotification(userId, {
      type: 'order_delay',
      title: 'Order Delay Notice',
      message,
      actionUrl: `/orders/${orderId}`,
      priority: 'urgent',
    });
  }

  /**
   * Handle ticket escalation trigger
   */
  private async handleTicketEscalation(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { ticketId, issue, escalatedTo } = data;

    const message = `Your support ticket #${ticketId} regarding "${issue}" 
has been escalated to ${escalatedTo}. They will contact you shortly.`;

    await this.sendNotification(userId, {
      type: 'ticket_escalation',
      title: 'Support Ticket Update',
      message,
      actionUrl: `/support/tickets/${ticketId}`,
      priority: 'high',
    });
  }

  /**
   * Handle restock alert trigger
   */
  private async handleRestockAlert(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { productId, productName } = data;

    const message = `Good news! ${productName} is back in stock. 
Order now before it sells out again!`;

    await this.sendNotification(userId, {
      type: 'restock_alert',
      title: 'Back in Stock!',
      message,
      actionUrl: `/product/${productId}`,
      priority: 'medium',
    });
  }

  /**
   * Handle personalized offer trigger
   */
  private async handlePersonalizedOffer(trigger: ProactiveTrigger): Promise<void> {
    const { userId, data } = trigger;
    const { offerTitle, discountCode, expiryDate } = data;

    const message = `Exclusive offer just for you: ${offerTitle}
Use code ${discountCode} at checkout. Expires: ${expiryDate}`;

    await this.sendNotification(userId, {
      type: 'personalized_offer',
      title: 'Special Offer!',
      message,
      actionUrl: '/offers',
      priority: 'medium',
    });
  }

  /**
   * Send notification to user
   */
  private async sendNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      actionUrl: string;
      priority: string;
    }
  ): Promise<void> {
    logger.info('RAG', 'Sending notification', {
      userId,
      type: notification.type,
      priority: notification.priority,
    });

    // Store notification in Redis
    const notificationId = `notif:${Date.now()}:${userId}`;
    await this.redis.lpush(
      `notifications:${userId}`,
      JSON.stringify({
        id: notificationId,
        ...notification,
        createdAt: Date.now(),
        read: false,
      })
    );

    // Trim to last 50 notifications
    await this.redis.ltrim(`notifications:${userId}`, 0, 49);

    // In production, integrate with email/SMS/push notification services
    if (this.config.enableEmail) {
      // await sendEmail(userId, notification);
      logger.debug('RAG', 'Email notification queued');
    }

    if (this.config.enableInApp) {
      // In-app notification via WebSocket
      // await websocketService.send(userId, notification);
      logger.debug('RAG', 'In-app notification queued');
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit = 10): Promise<unknown[]> {
    const notifications = await this.redis.lrange(`notifications:${userId}`, 0, limit - 1);
    return notifications.map((n) => JSON.parse(n));
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const notifications = await this.getUserNotifications(userId, 50);
    const updated = notifications.map((n: any) => {
      if (n.id === notificationId) {
        return { ...n, read: true };
      }
      return n;
    });

    await this.redis.del(`notifications:${userId}`);
    for (const n of updated) {
      await this.redis.lpush(`notifications:${userId}`, JSON.stringify(n));
    }
  }

  /**
   * Get trigger statistics
   */
  async getStats(): Promise<{
    totalTriggers: number;
    pendingTriggers: number;
    sentTriggers: number;
  }> {
    const allTriggerKeys = await this.redis.keys('triggers:*');
    let totalTriggers = 0;

    for (const key of allTriggerKeys) {
      const count = await this.redis.hlen(key);
      totalTriggers += count;
    }

    const pendingCount = await this.redis.zcard('trigger_schedule');

    return {
      totalTriggers,
      pendingTriggers: pendingCount,
      sentTriggers: totalTriggers - pendingCount,
    };
  }
}

/**
 * Singleton instance
 */
let cxManagerInstance: ProactiveCXManager | null = null;

/**
 * Get or create CX manager instance
 */
export function getProactiveCXManager(): ProactiveCXManager {
  if (!cxManagerInstance) {
    cxManagerInstance = new ProactiveCXManager();
  }
  return cxManagerInstance;
}

/**
 * Initialize proactive CX system
 */
export async function initializeProactiveCX(): Promise<void> {
  const manager = getProactiveCXManager();
  await manager.initialize();
}

/**
 * Helper functions for creating specific triggers
 */

/**
 * Track cart abandonment
 */
export async function trackCartAbandonment(
  userId: string,
  cartId: string,
  cartValue: number,
  itemCount: number
): Promise<string> {
  const manager = getProactiveCXManager();
  return manager.createTrigger(
    'cart_abandonment',
    userId,
    { cartId, cartValue, itemCount },
    'medium',
    60 // 1 hour delay
  );
}

/**
 * Track price drop
 */
export async function trackPriceDrop(
  userId: string,
  productId: string,
  productName: string,
  oldPrice: number,
  newPrice: number
): Promise<string> {
  const dropPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
  const manager = getProactiveCXManager();
  return manager.createTrigger(
    'price_drop',
    userId,
    { productId, productName, oldPrice, newPrice, dropPercent },
    'high'
  );
}

/**
 * Track order delay
 */
export async function trackOrderDelay(
  userId: string,
  orderId: string,
  expectedDate: string,
  newDate: string,
  reason: string
): Promise<string> {
  const manager = getProactiveCXManager();
  return manager.createTrigger(
    'order_delay',
    userId,
    { orderId, expectedDate, newDate, reason },
    'urgent'
  );
}
