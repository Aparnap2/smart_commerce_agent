import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useChatStore } from '../../store/chat.store';
import { useAgentStream } from '../../hooks/useAgentStream';
import { OrderList } from '../../components/genui/OrderList';
import { colors, font, spacing } from '../../lib/theme';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { submit } = useAgentStream();
  const uiEvents = useChatStore(s => s.uiEvents);
  const orderEvent = uiEvents.find((e): e is import('../../store/chat.store').UIEvent<'order-list'> => e.name === 'order-list');

  useFocusEffect(
    useCallback(() => {
      if (!orderEvent) {
        submit('Show me my recent orders');
      }
    }, [orderEvent, submit]),
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>My Orders</Text>
      </View>
      <View style={s.body}>
        <OrderList orders={orderEvent?.props.orders ?? []} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    fontSize: font.size.xl,
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
  },
  body: {
    flex: 1,
    padding: spacing[4],
  },
});
