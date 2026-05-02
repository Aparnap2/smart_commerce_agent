import { useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetFlatList, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius } from '../../lib/theme';

type CartItem = { productId: number; name: string; price: number; quantity: number };

export function CartSheet({ items, total, onCheckout }: { items: CartItem[]; total: number; onCheckout: () => void }) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['42%', '88%'], []);
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />, []);
  const renderItem = useCallback(({ item }: { item: CartItem }) => (<View style={s.item}><View style={s.itemLeft}><Text style={s.itemName} numberOfLines={1}>{item.name}</Text><Text style={s.itemQty}>₹{item.price.toLocaleString('en-IN')} × {item.quantity}</Text></View><Text style={s.itemTotal}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text></View>), []);
  return (
    <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(160)} pointerEvents="box-none">
      <BottomSheet ref={sheetRef} index={0} snapPoints={snapPoints} backdropComponent={renderBackdrop} handleIndicatorStyle={s.handle} backgroundStyle={s.sheetBg} enablePanDownToClose={false}>
        <BottomSheetView style={s.header}><View><Text style={s.title}>Your Cart</Text><Text style={s.subtitle}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text></View><Text style={s.headerTotal}>₹{total.toLocaleString('en-IN')}</Text></BottomSheetView>
        {items.length === 0 ? (<BottomSheetView style={s.empty}><Text style={s.emptyIcon}>🛒</Text><Text style={s.emptyText}>Your cart is empty</Text></BottomSheetView>) : (<BottomSheetFlatList data={items} keyExtractor={(i) => `c-${i.productId}`} renderItem={renderItem} contentContainerStyle={s.list} />)}
        {items.length > 0 && (<BottomSheetView style={s.footer}><View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalAmount}>₹{total.toLocaleString('en-IN')}</Text></View><TouchableOpacity style={s.checkoutBtn} onPress={async () => { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onCheckout(); }}><Text style={s.checkoutText}>Proceed to Checkout →</Text></TouchableOpacity></BottomSheetView>)}
      </BottomSheet>
    </Animated.View>
  );
}
const s = StyleSheet.create({ sheetBg: { backgroundColor: colors.surface }, handle: { backgroundColor: colors.divider, width: 36 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[6], paddingBottom: spacing[4], borderBottomWidth: 1, borderBottomColor: colors.divider }, title: { fontSize: font.size.xl, fontWeight: '700', color: colors.text, fontFamily: font.family }, subtitle: { fontSize: font.size.sm, color: colors.textMuted, fontFamily: font.family, marginTop: 2 }, headerTotal: { fontSize: font.size.xl, fontWeight: '700', color: colors.primary, fontFamily: font.family }, list: { paddingHorizontal: spacing[6], paddingTop: spacing[2] }, item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.divider }, itemLeft: { flex: 1, marginRight: spacing[4] }, itemName: { fontSize: font.size.base, fontWeight: '500', color: colors.text, fontFamily: font.family }, itemQty: { fontSize: font.size.sm, color: colors.textMuted, fontFamily: font.family, marginTop: 2 }, itemTotal: { fontSize: font.size.base, fontWeight: '600', color: colors.text, fontFamily: font.family }, empty: { alignItems: 'center', padding: spacing[12] }, emptyIcon: { fontSize: 48, marginBottom: spacing[3] }, emptyText: { fontSize: font.size.lg, color: colors.textMuted, fontFamily: font.family }, footer: { paddingHorizontal: spacing[6], paddingTop: spacing[4], paddingBottom: spacing[10], borderTopWidth: 1, borderTopColor: colors.divider }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }, totalLabel: { fontSize: font.size.lg, fontWeight: '600', color: colors.text, fontFamily: font.family }, totalAmount: { fontSize: font.size.xl, fontWeight: '700', color: colors.primary, fontFamily: font.family }, checkoutBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, height: 52, alignItems: 'center', justifyContent: 'center' }, checkoutText: { color: '#fff', fontSize: font.size.base, fontWeight: '700', fontFamily: font.family } });
