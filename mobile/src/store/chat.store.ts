import { create } from 'zustand';

export type Message = { id: string; role: 'human' | 'ai'; content: string; timestamp: number };

export type Product = {
  id: number; name: string; price: number; stock: number;
  brand?: string; imageUrl?: string; rating?: number;
};
export type CartItem = {
  productId: number; name: string; price: number; quantity: number; imageUrl?: string;
};
export type Order = {
  id: string; status: 'DELIVERED' | 'SHIPPED' | 'PAID' | 'PENDING' | 'CANCELLED'; total: number; orderDate: string; trackingNumber?: string;
};
export type ReturnOption = {
  type: string; label: string; description: string; amount?: number;
};

export type UIEventMap = {
  'product-grid': { products: Product[]; loading: boolean };
  'cart-canvas': { items: CartItem[]; total: number };
  'order-list': { orders: Order[] };
  'return-card': { eligible: boolean; options: ReturnOption[]; orderId: string };
};

export type UIEventName = keyof UIEventMap;

export type UIEvent<N extends UIEventName = UIEventName> = {
  id: string;
  name: N;
  props: UIEventMap[N];
  afterMsgId: string;
  timestamp: number;
};

type ChatStore = {
  messages: Message[];
  uiEvents: UIEvent[];
  isStreaming: boolean;
  error: string | null;
  threadId: string;
  addMessage: (m: Message) => void;
  upsertMessage: (id: string, content: string) => void;
  pushUIEvent: (e: UIEvent) => void;
  setStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

function newThreadId() { return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export const useChatStore = create<ChatStore>((set) => ({
  messages: [], uiEvents: [], isStreaming: false, error: null, threadId: newThreadId(),
  addMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  upsertMessage: (id, content) => set(s => {
    const exists = s.messages.some(mm => mm.id === id);
    if (exists) return { messages: s.messages.map(mm => mm.id === id ? { ...mm, content } : mm) };
    return { messages: [...s.messages, { id, content, role: 'ai' as const, timestamp: Date.now() }] };
  }),
  pushUIEvent: (e) => set(s => ({ uiEvents: [...s.uiEvents.filter(u => u.name !== e.name), e] })),
  setStreaming: (v) => set({ isStreaming: v }),
  setError: (e) => set({ error: e }),
  reset: () => set({ messages: [], uiEvents: [], isStreaming: false, error: null, threadId: newThreadId() }),
}));
