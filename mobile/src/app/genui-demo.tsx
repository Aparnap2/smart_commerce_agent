import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

// ── GenUI Component Registry ──────────────────────────────
// This proves the pattern works: LLM emits component name + props,
// React Native maps to component, renders with typed props.
// Same pattern as web app's useStream + LoadExternalComponent.

type GenUIName = 'product-card' | 'cart-summary' | 'order-status';

type ProductCardProps = { name: string; price: number; stock: number };
type CartSummaryProps = { items: string[]; total: number };
type OrderStatusProps = { status: string; eta: string };

// ── Product Card Component ────────────────────────────────
function ProductCard({ name, price, stock }: ProductCardProps) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{name}</Text>
      <Text style={s.price}>₹{price.toLocaleString('en-IN')}</Text>
      <Text style={stock > 0 ? s.inStock : s.outStock}>
        {stock > 0 ? `✅ In Stock (${stock})` : '❌ Out of Stock'}
      </Text>
      <TouchableOpacity style={s.addBtn} disabled={stock === 0}>
        <Text style={s.addBtnText}>{stock > 0 ? '+ Add to Cart' : 'Unavailable'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Cart Summary Component ────────────────────────────────
function CartSummary({ items, total }: CartSummaryProps) {
  return (
    <View style={[s.card, s.cartCard]}>
      <Text style={s.cardTitle}>🛒 Your Cart ({items.length})</Text>
      {items.map((item, i) => (
        <Text key={i} style={s.item}>• {item}</Text>
      ))}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total</Text>
        <Text style={s.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
      </View>
      <TouchableOpacity style={s.checkoutBtn}>
        <Text style={s.checkoutText}>Proceed to Checkout →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Order Status Component ────────────────────────────────
function OrderStatus({ status, eta }: OrderStatusProps) {
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

// ── Component Map (LLM → Component) ──────────────────────
const ComponentMap: Record<GenUIName, React.FC<any>> = {
  'product-card': ProductCard,
  'cart-summary': CartSummary,
  'order-status': OrderStatus,
};

// ── Demo Screen ───────────────────────────────────────────
export default function GenUIDemoScreen() {
  const [components, setComponents] = useState<Array<{ name: GenUIName; props: any }>>([]);

  // Simulate LLM response → renders GenUI components
  const simulateLLM = useCallback((query: string) => {
    const out: Array<{ name: GenUIName; props: any }> = [];
    if (query.includes('headphone') || query.includes('product')) {
      out.push({ name: 'product-card', props: { name: 'Sony WH-1000XM5', price: 26990, stock: 10 } });
      out.push({ name: 'product-card', props: { name: 'JBL Tune 760NC', price: 5999, stock: 0 } });
    }
    if (query.includes('cart')) {
      out.push({ name: 'cart-summary', props: { items: ['Sony WH-1000XM5', 'USB-C Cable'], total: 27489 } });
    }
    if (query.includes('order') || query.includes('track')) {
      out.push({ name: 'order-status', props: { status: 'Shipped', eta: 'Apr 16, 2026' } });
    }
    setComponents(out);
  }, []);

  return (
    <ScrollView style={s.screen}>
      <Text style={s.title}>🧪 GenUI Demo — Expo SDK 55</Text>
      <Text style={s.subtitle}>Dynamic LLM-rendered components in React Native (Web)</Text>

      <View style={s.buttonRow}>
        <TouchableOpacity style={s.chip} onPress={() => simulateLLM('Show me headphones')}><Text style={s.chipText}>🎧 Headphones</Text></TouchableOpacity>
        <TouchableOpacity style={s.chip} onPress={() => simulateLLM('View my cart')}><Text style={s.chipText}>🛒 Cart</Text></TouchableOpacity>
        <TouchableOpacity style={s.chip} onPress={() => simulateLLM('Track my order')}><Text style={s.chipText}>📦 Orders</Text></TouchableOpacity>
      </View>

      {components.length === 0 && (
        <Text style={s.empty}>Tap a chip to simulate LLM rendering GenUI components</Text>
      )}

      {components.map((c, i) => {
        const Comp = ComponentMap[c.name];
        return Comp ? <Comp key={i} {...c.props} /> : <Text>Unknown: {c.name}</Text>;
      })}

      <View style={s.infoBox}>
        <Text style={s.infoTitle}>How This Works in Production:</Text>
        <Text style={s.infoText}>1. Python agent emits SSE events with component name + props</Text>
        <Text style={s.infoText}>2. Expo app reads SSE, maps name → component via registry</Text>
        <Text style={s.infoText}>3. Component renders with typed props (type-safe)</Text>
        <Text style={s.infoText}>4. Same pattern as web (useStream + LoadExternalComponent)</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f6f2', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#28251d', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#7a7974', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { backgroundColor: '#01696f', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#bab9b4', fontSize: 14, paddingVertical: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d4d1ca' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#28251d', marginBottom: 4 },
  price: { fontSize: 20, fontWeight: '700', color: '#01696f', marginBottom: 8 },
  inStock: { fontSize: 13, color: '#437a22', marginBottom: 8 },
  outStock: { fontSize: 13, color: '#a12c7b', marginBottom: 8 },
  addBtn: { backgroundColor: '#01696f', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cartCard: {}, item: { fontSize: 14, color: '#28251d', paddingVertical: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e8e5e0' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#28251d' },
  totalAmount: { fontSize: 18, fontWeight: '700', color: '#01696f' },
  checkoutBtn: { backgroundColor: '#01696f', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  checkoutText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  orderCard: {}, eta: { fontSize: 14, color: '#7a7974', marginTop: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  infoBox: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#d4d1ca' },
  infoTitle: { fontSize: 16, fontWeight: '600', color: '#28251d', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#7a7974', lineHeight: 20, marginBottom: 2 },
});
