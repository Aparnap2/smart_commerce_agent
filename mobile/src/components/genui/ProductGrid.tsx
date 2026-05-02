import { useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius, shadow } from '../../lib/theme';

type Product = { id: number; name: string; price: number; stock: number; brand?: string; imageUrl?: string; rating?: number };

const ProductCard = memo(function ProductCard({ product, onAddToCart, index }: { product: Product; onAddToCart: (id: number, name: string) => void; index: number }) {
  const scale = useSharedValue(1);
  const oos = product.stock === 0;
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleAdd = useCallback(async () => { if (oos) return; scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1, { damping: 20 }) }); await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onAddToCart(product.id, product.name); }, [oos, product.id, product.name, onAddToCart]);
  return (
    <Animated.View style={[s.card, pressStyle]} entering={FadeInDown.delay(index * 50).springify().damping(18)}>
      <View style={s.imgBox}><View style={[s.img, s.imgFallback]}><Text style={s.imgEmoji}>📦</Text></View>{oos && <View style={s.oosOverlay}><Text style={s.oosText}>Out of Stock</Text></View>}{product.brand && <View style={s.brandPill}><Text style={s.brandText}>{product.brand}</Text></View>}</View>
      <Text style={s.name} numberOfLines={2}>{product.name}</Text>
      {product.rating != null && <Text style={s.rating}>⭐ {product.rating.toFixed(1)}</Text>}
      <Text style={s.price}>₹{product.price.toLocaleString('en-IN')}</Text>
      <TouchableOpacity style={[s.addBtn, oos && s.addBtnOff]} onPress={handleAdd} disabled={oos}><Text style={[s.addBtnText, oos && s.addBtnTextOff]}>{oos ? 'Out of Stock' : '+ Add'}</Text></TouchableOpacity>
    </Animated.View>
  );
});

export const ProductGrid = memo(function ProductGrid({ products, loading, onAddToCart }: { products: Product[]; loading: boolean; onAddToCart: (id: number, name: string) => void }) {
  const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => <ProductCard product={item} onAddToCart={onAddToCart} index={index} />, [onAddToCart]);
  if (loading) return <View style={s.empty}><Text style={s.emptyIcon}>⏳</Text><Text style={s.emptyTitle}>Searching...</Text></View>;
  if (products.length === 0) return <View style={s.empty}><Text style={s.emptyIcon}>🔍</Text><Text style={s.emptyTitle}>No products found</Text><Text style={s.emptySub}>Try another search</Text></View>;
  return <View style={{ maxHeight: 480 }}><FlashList data={products} renderItem={renderItem} numColumns={2} estimatedItemSize={232} keyExtractor={(item: Product) => `p-${item.id}`} getItemType={() => 'product'} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing[4] }} /></View>;
});

const s = StyleSheet.create({
  card: { flex: 1, minWidth: '44%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[3], margin: spacing[2], ...shadow.sm },
  imgBox: { position: 'relative', marginBottom: spacing[2] },
  img: { width: '100%', height: 108, borderRadius: radius.md, backgroundColor: colors.surfaceOffset, alignItems: 'center', justifyContent: 'center' },
  imgFallback: {}, imgEmoji: { fontSize: 36 },
  oosOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.52)', borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, paddingVertical: spacing[2], alignItems: 'center' },
  oosText: { color: '#fff', fontSize: 10, fontWeight: '600', fontFamily: font.family },
  brandPill: { position: 'absolute', top: spacing[2], left: spacing[2], backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  brandText: { fontSize: 10, fontWeight: '600', color: colors.text, fontFamily: font.family },
  name: { fontSize: font.size.sm, fontWeight: '600', color: colors.text, fontFamily: font.family, lineHeight: 18, marginBottom: spacing[1] },
  rating: { fontSize: font.size.xs, color: colors.textMuted, fontFamily: font.family, marginBottom: spacing[1] },
  price: { fontSize: font.size.lg, fontWeight: '700', color: colors.primary, fontFamily: font.family, marginBottom: spacing[2] },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing[2], alignItems: 'center' },
  addBtnOff: { backgroundColor: colors.border },
  addBtnText: { color: '#fff', fontSize: font.size.sm, fontWeight: '700', fontFamily: font.family },
  addBtnTextOff: { color: colors.textMuted },
  empty: { alignItems: 'center', padding: spacing[8] },
  emptyIcon: { fontSize: 40, marginBottom: spacing[2] },
  emptyTitle: { fontSize: font.size.lg, fontWeight: '600', color: colors.text, fontFamily: font.family },
  emptySub: { fontSize: font.size.sm, color: colors.textMuted, fontFamily: font.family, marginTop: spacing[2] },
});
