/**
 * TicketStatus Component
 *
 * Displays support ticket status with timeline, messages, and actions
 * for the e-commerce agent.
 *
 * @packageDocumentation
 */

'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  User,
  Mail,
  Tag,
  ChevronRight,
  Send,
  Paperclip,
  MoreVertical,
  ArrowUpCircle,
  Shield,
  Calendar,
  Phone,
  CreditCard,
  Package,
  Truck,
  DollarSign,
} from 'lucide-react';

// Ticket status types
export type TicketStatus = 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'order_status'
  | 'shipping'
  | 'return'
  | 'refund'
  | 'product_info'
  | 'payment'
  | 'account'
  | 'technical'
  | 'other';

// Message interface
export interface TicketMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorType: 'customer' | 'agent' | 'system';
  content: string;
  timestamp: string;
  isInternal?: boolean;
  attachments?: Array<{ name: string; url: string }>;
}

// Ticket data interface
export interface TicketData {
  id: string;
  orderId?: string;
  orderNumber?: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  messages: TicketMessage[];
  tags?: string[];
  satisfactionRating?: number;
  firstResponseTime?: number;
  resolutionTime?: number;
}

// Status configuration
const statusConfig: Record<TicketStatus, { color: string; icon: React.ElementType; label: string }> = {
  open: {
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    icon: AlertCircle,
    label: 'Open',
  },
  in_progress: {
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    icon: Clock,
    label: 'In Progress',
  },
  pending_customer: {
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    icon: Clock,
    label: 'Waiting for Customer',
  },
  resolved: {
    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    icon: CheckCircle,
    label: 'Resolved',
  },
  closed: {
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    icon: XCircle,
    label: 'Closed',
  },
};

// Priority configuration
const priorityConfig: Record<TicketPriority, { color: string; label: string; level: number }> = {
  low: { color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', label: 'Low', level: 1 },
  medium: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', label: 'Medium', level: 2 },
  high: { color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400', label: 'High', level: 3 },
  urgent: { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', label: 'Urgent', level: 4 },
};

// Category configuration
const categoryConfig: Record<TicketCategory, { icon: React.ElementType; label: string }> = {
  order_status: { icon: Package, label: 'Order Status' },
  shipping: { icon: Truck, label: 'Shipping' },
  return: { icon: ArrowUpCircle, label: 'Return' },
  refund: { icon: DollarSign, label: 'Refund' },
  product_info: { icon: Tag, label: 'Product Info' },
  payment: { icon: CreditCard, label: 'Payment' },
  account: { icon: User, label: 'Account' },
  technical: { icon: Shield, label: 'Technical' },
  other: { icon: MessageSquare, label: 'Other' },
};

// Format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Format duration in minutes
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// Author avatar component
function AuthorAvatar({ authorType, name }: { authorType: 'customer' | 'agent' | 'system'; name: string }) {
  const bgColors = {
    customer: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    agent: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    system: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgColors[authorType]}`}>
      <User className="w-4 h-4" />
    </div>
  );
}

// Message bubble component
function MessageBubble({ message }: { message: TicketMessage }) {
  const isAgent = message.authorType === 'agent';
  const isSystem = message.authorType === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3 h-3" />
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <AuthorAvatar authorType={message.authorType} name={message.authorName} />
      <div className={`flex-1 max-w-[80%] ${isAgent ? 'items-end' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {message.authorName}
          </span>
          <span className="text-xs text-gray-400">{formatTimeAgo(message.timestamp)}</span>
          {message.isInternal && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
              Internal
            </span>
          )}
        </div>
        <div
          className={`rounded-lg p-3 ${
            isAgent
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.name}
                href={attachment.url}
                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Paperclip className="w-3 h-3" />
                {attachment.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: TicketStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config = priorityConfig[priority];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// Category badge component
function CategoryBadge({ category }: { category: TicketCategory }) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Metrics row component
function MetricsRow({ ticket }: { ticket: TicketData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Created</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatTimeAgo(ticket.createdAt)}
        </p>
      </div>
      {ticket.firstResponseTime && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">First Response</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDuration(ticket.firstResponseTime)}
          </p>
        </div>
      )}
      {ticket.resolutionTime && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resolution Time</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDuration(ticket.resolutionTime)}
          </p>
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Messages</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {ticket.messages.length}
        </p>
      </div>
    </div>
  );
}

// Message input component
interface MessageInputProps {
  onSend: (message: string, isInternal: boolean) => void;
  placeholder?: string;
}

function MessageInput({ onSend, placeholder = 'Type your message...' }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim(), isInternal);
      setMessage('');
      setIsInternal(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Internal note
        </label>
      </div>
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Main TicketStatus component
interface TicketStatusProps {
  ticket: TicketData;
  onReply?: (message: string, isInternal: boolean) => void;
  onUpdateStatus?: (ticketId: string, status: TicketStatus) => void;
  onUpdatePriority?: (ticketId: string, priority: TicketPriority) => void;
  onAssign?: (ticketId: string, agentId: string) => void;
  onResolve?: (ticketId: string) => void;
  onClose?: (ticketId: string) => void;
  onViewOrder?: (orderId: string) => void;
  className?: string;
}

export function TicketStatus({
  ticket,
  onReply,
  onUpdateStatus,
  onUpdatePriority,
  onAssign,
  onResolve,
  onClose,
  onViewOrder,
  className = '',
}: TicketStatusProps) {
  const status = statusConfig[ticket.status];
  const priority = priorityConfig[ticket.priority];
  const category = categoryConfig[ticket.category];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                #{ticket.id}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {ticket.subject}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onResolve && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <button
                onClick={() => onResolve(ticket.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Resolve
              </button>
            )}
            {onClose && ticket.status !== 'closed' && (
              <button
                onClick={() => onClose(ticket.id)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customer info */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {ticket.customerName}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {ticket.customerEmail}
                </span>
                {ticket.customerPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {ticket.customerPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
          {ticket.orderNumber && onViewOrder && (
            <button
              onClick={() => onViewOrder(ticket.orderId!)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Order #{ticket.orderNumber}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="px-4">
        <MetricsRow ticket={ticket} />
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
          {ticket.description}
        </p>
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {ticket.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages thread */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Conversation
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({ticket.messages.length} messages)
          </span>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {ticket.messages.map((message) => (
            <React.Fragment key={message.id}>
              <MessageBubble message={message} />
            </React.Fragment>
          ))}
        </div>

        {/* Reply input */}
        {onReply && ticket.status !== 'closed' && (
          <MessageInput
            onSend={(message, isInternal) => onReply(message, isInternal)}
            placeholder="Write a reply..."
          />
        )}
      </div>
    </div>
  );
}

// TicketStatus skeleton for loading states
export function TicketStatusSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-600 rounded" />
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-600 rounded-full" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-600 rounded" />
        </div>
        <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-600 rounded" />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-3 w-48 bg-gray-200 dark:bg-gray-600 rounded" />
          </div>
        </div>
        <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded-lg" />
      </div>
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
        <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

// Compact ticket card for lists
interface TicketCardCompactProps {
  ticket: TicketData;
  onClick?: (ticketId: string) => void;
}

export function TicketCardCompact({ ticket, onClick }: TicketCardCompactProps) {
  const status = statusConfig[ticket.status];
  const priority = priorityConfig[ticket.priority];
  const statusIcon = status.icon;

  return (
    <div
      onClick={() => onClick?.(ticket.id)}
      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              #{ticket.id}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${status.color}`}
            >
              <statusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}
            >
              {priority.label}
            </span>
          </div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {ticket.subject}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {ticket.customerName} • {formatTimeAgo(ticket.updatedAt)}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
      </div>
    </div>
  );
}

export default TicketStatus;
