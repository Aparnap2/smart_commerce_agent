/**
 * Agent State Store
 *
 * State management for the e-commerce agent with hydration support
 * for streaming responses and server-side state.
 *
 * @packageDocumentation
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { OrderData } from '../../app/dashboard/components/genui/index.js';
import type { ProductData } from '../../app/dashboard/components/genui/index.js';
import type { TicketData } from '../../app/dashboard/components/genui/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent message types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Agent message interface
 */
export interface AgentMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    id: string;
    name: string;
    result: unknown;
    success: boolean;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Agent session state
 */
export interface AgentSession {
  id: string;
  userId: string;
  messages: AgentMessage[];
  context: {
    orders: Map<string, OrderData>;
    products: Map<string, ProductData>;
    tickets: Map<string, TicketData>;
  };
  preferences: {
    maxResults: number;
    includeMetadata: boolean;
    streamingEnabled: boolean;
  };
  metadata: {
    createdAt: number;
    lastActivityAt: number;
    totalTokens: number;
    totalToolCalls: number;
  };
}

/**
 * UI state for the agent
 */
export interface AgentUIState {
  isLoading: boolean;
  isStreaming: boolean;
  activeView: 'chat' | 'orders' | 'products' | 'tickets' | 'dashboard';
  selectedOrderId: string | null;
  selectedProductId: string | null;
  selectedTicketId: string | null;
  sidebarOpen: boolean;
  searchQuery: string;
  filters: Record<string, unknown>;
}

/**
 * Complete agent store state
 */
export interface AgentState {
  session: AgentSession | null;
  ui: AgentUIState;
}

/**
 * Store actions
 */
export interface AgentActions {
  // Session management
  createSession: (userId: string) => AgentSession;
  endSession: () => void;
  loadSession: (session: AgentSession) => void;

  // Message management
  addMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => AgentMessage;
  updateMessage: (messageId: string, updates: Partial<AgentMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;

  // Tool call management
  addToolCall: (messageId: string, toolCall: AgentMessage['toolCalls'][0]) => void;
  completeToolCall: (messageId: string, toolCallId: string, result: unknown, success: boolean) => void;

  // Context management
  setOrders: (orders: OrderData[]) => void;
  addOrder: (order: OrderData) => void;
  getOrder: (orderId: string) => OrderData | undefined;

  setProducts: (products: ProductData[]) => void;
  addProduct: (product: ProductData) => void;
  getProduct: (productId: string) => ProductData | undefined;

  setTickets: (tickets: TicketData[]) => void;
  addTicket: (ticket: TicketData) => void;
  getTicket: (ticketId: string) => TicketData | undefined;

  // UI management
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setActiveView: (view: AgentUIState['activeView']) => void;
  setSelectedOrder: (orderId: string | null) => void;
  setSelectedProduct: (productId: string | null) => void;
  setSelectedTicket: (ticketId: string | null) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Record<string, unknown>) => void;

  // Preferences
  setMaxResults: (max: number) => void;
  setIncludeMetadata: (include: boolean) => void;
  setStreamingEnabled: (enabled: boolean) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

function createInitialState(): AgentState {
  return {
    session: null,
    ui: {
      isLoading: false,
      isStreaming: false,
      activeView: 'chat',
      selectedOrderId: null,
      selectedProductId: null,
      selectedTicketId: null,
      sidebarOpen: true,
      searchQuery: '',
      filters: {},
    },
  };
}

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Agent state store with persistence
 */
export const useAgentStore = create<AgentState & AgentActions>()(
  persist(
    (set, get) => {
      // Generate unique ID
      const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      return {
        ...createInitialState(),

        // Session management
        createSession: (userId: string) => {
          const session: AgentSession = {
            id: generateId(),
            userId,
            messages: [],
            context: {
              orders: new Map(),
              products: new Map(),
              tickets: new Map(),
            },
            preferences: {
              maxResults: 10,
              includeMetadata: true,
              streamingEnabled: true,
            },
            metadata: {
              createdAt: Date.now(),
              lastActivityAt: Date.now(),
              totalTokens: 0,
              totalToolCalls: 0,
            },
          };

          set({ session });
          return session;
        },

        endSession: () => {
          set({ session: null, ui: createInitialState().ui });
        },

        loadSession: (session: AgentSession) => {
          // Convert plain objects to Maps
          const context = {
            orders: new Map(Object.entries(session.context.orders || {})),
            products: new Map(Object.entries(session.context.products || {})),
            tickets: new Map(Object.entries(session.context.tickets || {})),
          };

          set({
            session: { ...session, context },
          });
        },

        // Message management
        addMessage: (messageData) => {
          const message: AgentMessage = {
            ...messageData,
            id: generateId(),
            timestamp: Date.now(),
          };

          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: [...state.session.messages, message],
                metadata: {
                  ...state.session.metadata,
                  lastActivityAt: Date.now(),
                },
              },
            };
          });

          return message;
        },

        updateMessage: (messageId, updates) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: state.session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
              },
            };
          });
        },

        removeMessage: (messageId) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: state.session.messages.filter((msg) => msg.id !== messageId),
              },
            };
          });
        },

        clearMessages: () => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: [],
              },
            };
          });
        },

        // Tool call management
        addToolCall: (messageId, toolCall) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: state.session.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        toolCalls: [...(msg.toolCalls || []), toolCall],
                      }
                    : msg
                ),
              },
            };
          });
        },

        completeToolCall: (messageId, toolCallId, result, success) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                messages: state.session.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        toolResults: [
                          ...(msg.toolResults || []),
                          { id: toolCallId, name: '', result, success },
                        ],
                        toolCalls: (msg.toolCalls || []).map((tc) =>
                          tc.id === toolCallId ? { ...tc, result, success } : tc
                        ),
                      }
                    : msg
                ),
                metadata: {
                  ...state.session.metadata,
                  totalToolCalls: state.session.metadata.totalToolCalls + 1,
                },
              },
            };
          });
        },

        // Context management - Orders
        setOrders: (orders) => {
          set((state) => {
            if (!state.session) return state;

            const orderMap = new Map<string, OrderData>();
            orders.forEach((order) => orderMap.set(order.id, order));

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  orders: orderMap,
                },
              },
            };
          });
        },

        addOrder: (order) => {
          set((state) => {
            if (!state.session) return state;

            const orders = new Map(state.session.context.orders);
            orders.set(order.id, order);

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  orders,
                },
              },
            };
          });
        },

        getOrder: (orderId) => {
          return get().session?.context.orders.get(orderId);
        },

        // Context management - Products
        setProducts: (products) => {
          set((state) => {
            if (!state.session) return state;

            const productMap = new Map<string, ProductData>();
            products.forEach((product) => productMap.set(product.id, product));

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  products: productMap,
                },
              },
            };
          });
        },

        addProduct: (product) => {
          set((state) => {
            if (!state.session) return state;

            const products = new Map(state.session.context.products);
            products.set(product.id, product);

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  products,
                },
              },
            };
          });
        },

        getProduct: (productId) => {
          return get().session?.context.products.get(productId);
        },

        // Context management - Tickets
        setTickets: (tickets) => {
          set((state) => {
            if (!state.session) return state;

            const ticketMap = new Map<string, TicketData>();
            tickets.forEach((ticket) => ticketMap.set(ticket.id, ticket));

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  tickets: ticketMap,
                },
              },
            };
          });
        },

        addTicket: (ticket) => {
          set((state) => {
            if (!state.session) return state;

            const tickets = new Map(state.session.context.tickets);
            tickets.set(ticket.id, ticket);

            return {
              session: {
                ...state.session,
                context: {
                  ...state.session.context,
                  tickets,
                },
              },
            };
          });
        },

        getTicket: (ticketId) => {
          return get().session?.context.tickets.get(ticketId);
        },

        // UI management
        setLoading: (loading) => {
          set((state) => ({
            ui: { ...state.ui, isLoading: loading },
          }));
        },

        setStreaming: (streaming) => {
          set((state) => ({
            ui: { ...state.ui, isStreaming: streaming },
          }));
        },

        setActiveView: (view) => {
          set((state) => ({
            ui: { ...state.ui, activeView: view },
          }));
        },

        setSelectedOrder: (orderId) => {
          set((state) => ({
            ui: { ...state.ui, selectedOrderId: orderId },
          }));
        },

        setSelectedProduct: (productId) => {
          set((state) => ({
            ui: { ...state.ui, selectedProductId: productId },
          }));
        },

        setSelectedTicket: (ticketId) => {
          set((state) => ({
            ui: { ...state.ui, selectedTicketId: ticketId },
          }));
        },

        toggleSidebar: () => {
          set((state) => ({
            ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
          }));
        },

        setSearchQuery: (query) => {
          set((state) => ({
            ui: { ...state.ui, searchQuery: query },
          }));
        },

        setFilters: (filters) => {
          set((state) => ({
            ui: { ...state.ui, filters },
          }));
        },

        // Preferences
        setMaxResults: (max) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                preferences: { ...state.session.preferences, maxResults: max },
              },
            };
          });
        },

        setIncludeMetadata: (include) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                preferences: { ...state.session.preferences, includeMetadata: include },
              },
            };
          });
        },

        setStreamingEnabled: (enabled) => {
          set((state) => {
            if (!state.session) return state;

            return {
              session: {
                ...state.session,
                preferences: { ...state.session.preferences, streamingEnabled: enabled },
              },
            };
          });
        },

        // Reset
        reset: () => {
          set(createInitialState());
        },
      };
    },
    {
      name: 'agent-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        session: state.session
          ? {
              ...state.session,
              context: {
                orders: Object.fromEntries(state.session.context.orders),
                products: Object.fromEntries(state.session.context.products),
                tickets: Object.fromEntries(state.session.context.tickets),
              },
            }
          : null,
        ui: state.ui,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select current session
 */
export const selectSession = (state: AgentState & AgentActions) => state.session;

/**
 * Select messages
 */
export const selectMessages = (state: AgentState & AgentActions) =>
  state.session?.messages || [];

/**
 * Select current view
 */
export const selectActiveView = (state: AgentState & AgentActions) => state.ui.activeView;

/**
 * Select loading state
 */
export const selectIsLoading = (state: AgentState & AgentActions) => state.ui.isLoading;

/**
 * Select streaming state
 */
export const selectIsStreaming = (state: AgentState & AgentActions) => state.ui.isStreaming;

/**
 * Select user preferences
 */
export const selectPreferences = (state: AgentState & AgentActions) =>
  state.session?.preferences;

export default useAgentStore;
