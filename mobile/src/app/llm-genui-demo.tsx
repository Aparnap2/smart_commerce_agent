import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { z } from 'zod';

// ── Zod Schema: LLM must return this exact structure ──────────────
const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  stock: z.number(),
  brand: z.string().optional(),
});

const CartItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
});

// Union of all possible GenUI responses the LLM can generate
const GenUIResponseSchema = z.object({
  type: z.enum(['product-card', 'cart-summary', 'order-status', 'error']),
  text: z.string().describe('Natural language response from the LLM'),
  products: z.array(ProductSchema).optional(),
  cartItems: z.array(CartItemSchema).optional(),
  orderStatus: z.string().optional(),
  orderEta: z.string().optional(),
});

type GenUIResponse = z.infer<typeof GenUIResponseSchema>;

// ── Ollama Cloud API call ─────────────────────────────────────────
const OLLAMA_CLOUD_URL = 'https://ollama.com/api/chat';
const OLLAMA_API_KEY = process.env.EXPO_PUBLIC_OLLAMA_API_KEY || '';

async function queryLLM(userMessage: string): Promise<GenUIResponse> {
  const response = await fetch(OLLAMA_CLOUD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'nemotron-3-super:cloud',
      messages: [
        {
          role: 'system',
          content: `You are a TechTrend shopping assistant. Respond ONLY with valid JSON matching this schema:
{
  "type": "product-card" | "cart-summary" | "order-status" | "error",
  "text": "your natural language response",
  "products": [{"name": "...", "price": number, "stock": number, "brand": "optional"}],
  "cartItems": [{"name": "...", "quantity": number, "price": number}],
  "orderStatus": "Shipped" | "Delivered" | "Pending",
  "orderEta": "Apr 16, 2026"
}

If user asks about products → type:"product-card" with products array (2-3 items)
If user asks about cart → type:"cart-summary" with cartItems array
If user asks about order → type:"order-status" with orderStatus + orderEta
If you can't help → type:"error" with text explanation
`,
        },
        { role: 'user', content: userMessage },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Ollama Cloud error ${response.status}: ${errBody.slice(0, 100)}`);
  }
  const data = await response.json();
  let content = data.message?.content || '';

  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) content = jsonMatch[1];

  // Validate with Zod
  const parsed = JSON.parse(content);
  return GenUIResponseSchema.parse(parsed);
}

// ── Product Card Component ────────────────────────────────────────
function ProductCard({ name, price, stock, brand }: { name: string; price: number; stock: number; brand?: string }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{name}</Text>
      {brand && <Text style={s.brand}>Brand: {brand}</Text>}
      <Text style={s.price}>₹{price.toLocaleString('en-IN')}</Text>
      <Text style={stock > 0 ? s.inStock : s.outStock}>
        {stock > 0 ? `✅ In Stock (${stock})` : '❌ Out of Stock'}
      </Text>
    </View>
  );
}

// ── Cart Summary Component ────────────────────────────────────────
function CartSummary({ items, total }: { items: { name: string; quantity: number; price: number }[]; total: number }) {
  return (
    <View style={[s.card, s.cartCard]}>
      <Text style={s.cardTitle}>🛒 Your Cart ({items.length} items)</Text>
      {items.map((item, i) => (
        <View key={i} style={s.cartItem}>
          <Text style={s.cartItemName}>• {item.name}</Text>
          <Text style={s.cartItemQty}>× {item.quantity}</Text>
          <Text style={s.cartItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
        </View>
      ))}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
}

// ── Order Status Component ────────────────────────────────────────
function OrderStatus({ status, eta }: { status: string; eta: string }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'Delivered': { bg: '#d4dfcc', text: '#2e5c10' },
    'Shipped':   { bg: '#dacfde', text: '#5e2099' },
    'Pending':   { bg: '#e9e0c6', text: '#8a5b00' },
  };
  const scheme = statusColors[status] ?? { bg: '#e8e5e0', text: '#7a7974' };
  return (
    <View style={[s.card, s.orderCard]}>
      <View style={s.statusRow}>
        <Text style={s.cardTitle}>📦 Order</Text>
        <View style={[s.badge, { backgroundColor: scheme.bg }]}>
          <Text style={[s.badgeText, { color: scheme.text }]}>{status}</Text>
        </View>
      </View>
      <Text style={s.eta}>ETA: {eta}</Text>
    </View>
  );
}

// ── Main Demo Screen ──────────────────────────────────────────────
export default function LLMGenUIDemoScreen() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<GenUIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [llmRaw, setLlmRaw] = useState('');

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError('');
    setResponse(null);
    setLlmRaw('');

    try {
      const result = await queryLLM(input.trim());
      setResponse(result);
      setLlmRaw(JSON.stringify(result, null, 2));
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  // Example queries
  const examples = [
    'Show me Sony headphones',
    'What is in my cart?',
    'Track my recent order',
    'Show wireless earbuds under 5000',
  ];

  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>🧪 Real LLM GenUI — Expo SDK 55</Text>
      <Text style={s.subtitle}>LLM generates JSON → Zod validates → UI renders</Text>

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about products, cart, or orders..."
          placeholderTextColor="#bab9b4"
          onSubmitEditing={handleSend}
          editable={!loading}
        />
        <TouchableOpacity style={[s.sendBtn, loading && s.sendBtnDisabled]} onPress={handleSend} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.sendBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Example queries */}
      <View style={s.examples}>
        {examples.map((ex) => (
          <TouchableOpacity
            key={ex}
            style={s.chip}
            onPress={() => { setInput(ex); }}
          >
            <Text style={s.chipText}>{ex}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LLM Response */}
      {loading && <Text style={s.loading}>⏳ Calling Ollama (qwen3:0.6b)...</Text>}

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>❌ {error}</Text>
          <Text style={s.errorHint}>Ollama must be running: docker exec ollama ollama list</Text>
        </View>
      )}

      {response && (
        <>
          {/* LLM's natural language response */}
          <View style={s.llmBox}>
            <Text style={s.llmLabel}>🤖 LLM Response:</Text>
            <Text style={s.llmText}>{response.text}</Text>
          </View>

          {/* Zod-validated structured data → rendered component */}
          {response.type === 'product-card' && response.products?.map((p, i) => (
            <ProductCard key={i} name={p.name} price={p.price} stock={p.stock} brand={p.brand} />
          ))}

          {response.type === 'cart-summary' && response.cartItems && (
            <CartSummary
              items={response.cartItems}
              total={response.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)}
            />
          )}

          {response.type === 'order-status' && response.orderStatus && (
            <OrderStatus status={response.orderStatus} eta={response.orderEta || 'Unknown'} />
          )}

          {/* Raw JSON proof — shows Zod validation worked */}
          <View style={s.jsonBox}>
            <Text style={s.jsonLabel}>📋 Zod-Validated JSON (LLM output):</Text>
            <Text style={s.jsonText}>{llmRaw}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f6f2', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#28251d', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#7a7974', marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: { flex: 1, height: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d1ca', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#28251d' },
  sendBtn: { backgroundColor: '#01696f', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  chip: { backgroundColor: '#01696f', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  loading: { textAlign: 'center', color: '#01696f', fontSize: 14, paddingVertical: 20 },
  errorBox: { backgroundColor: '#fce4ec', borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText: { color: '#a12c7b', fontSize: 14, fontWeight: '600' },
  errorHint: { color: '#a12c7b', fontSize: 12, marginTop: 4 },
  llmBox: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#d4d1ca' },
  llmLabel: { fontSize: 14, fontWeight: '600', color: '#28251d', marginBottom: 6 },
  llmText: { fontSize: 14, color: '#28251d', lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d4d1ca' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#28251d', marginBottom: 4 },
  brand: { fontSize: 12, color: '#7a7974', marginBottom: 2 },
  price: { fontSize: 20, fontWeight: '700', color: '#01696f', marginBottom: 8 },
  inStock: { fontSize: 13, color: '#437a22' },
  outStock: { fontSize: 13, color: '#a12c7b' },
  cartCard: {},
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cartItemName: { fontSize: 14, color: '#28251d', flex: 1 },
  cartItemQty: { fontSize: 14, color: '#7a7974', marginRight: 8 },
  cartItemPrice: { fontSize: 14, fontWeight: '600', color: '#01696f' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e8e5e0' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#28251d' },
  totalAmount: { fontSize: 18, fontWeight: '700', color: '#01696f' },
  orderCard: {},
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  eta: { fontSize: 14, color: '#7a7974' },
  jsonBox: { backgroundColor: '#1e1e1e', borderRadius: 10, padding: 14, marginTop: 8 },
  jsonLabel: { fontSize: 14, fontWeight: '600', color: '#4fc3f7', marginBottom: 8 },
  jsonText: { fontSize: 12, color: '#a5d6a7', fontFamily: 'monospace' },
});
