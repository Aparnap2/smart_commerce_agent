import { useRef, useEffect, useCallback, useMemo, type ComponentRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ScrollViewComponent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useChatStore } from '../../store/chat.store';
import { useAuthStore } from '../../store/auth.store';
import { useAgentStream } from '../../hooks/useAgentStream';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChatInput } from '../../components/chat/ChatInput';
import { AgentThinking } from '../../components/chat/AgentThinking';
import { SuggestedActions } from '../../components/chat/SuggestedActions';
import { ProductGrid } from '../../components/genui/ProductGrid';
import { CartSheet } from '../../components/genui/CartSheet';
import { OrderList } from '../../components/genui/OrderList';
import { ReturnCard } from '../../components/genui/ReturnCard';
import { colors, font, spacing, shadow } from '../../lib/theme';

type MsgItem = { kind: 'message'; id: string; ts: number; data: any };
type UIItem = { kind: 'ui'; id: string; ts: number; data: any };
type ThinkItem = { kind: 'thinking'; id: 'thinking'; ts: number };
type ListItem = MsgItem | UIItem | ThinkItem;

export default function ChatScreen() {
  const listRef = useRef<FlashListRef<ListItem>>(null);
  const insets = useSafeAreaInsets();
  const { submit, stop } = useAgentStream();
  const messages = useChatStore(s => s.messages);
  const uiEvents = useChatStore(s => s.uiEvents);
  const isStreaming = useChatStore(s => s.isStreaming);
  const error = useChatStore(s => s.error);
  const reset = useChatStore(s => s.reset);
  const user = useAuthStore(s => s.user);
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const isEmpty = messages.length === 0;

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [
      ...messages.map(m => ({ kind: 'message' as const, id: m.id, ts: m.timestamp, data: m })),
      ...uiEvents.map(e => ({ kind: 'ui' as const, id: e.id, ts: e.timestamp, data: e })),
    ].sort((a, b) => a.ts - b.ts);
    if (isStreaming) items.push({ kind: 'thinking', id: 'thinking', ts: Date.now() });
    return items;
  }, [messages, uiEvents, isStreaming]);

  useEffect(() => {
    if (listData.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [listData.length]);

  const handleAddToCart = useCallback(
    (id: number, name: string) => {
      submit(`Please add ${name} (product id: ${id}) to my cart`);
    },
    [submit],
  );

  const handleCheckout = useCallback(() => {
    submit("I'm ready to checkout");
  }, [submit]);

  const handleReturnSelect = useCallback(
    (type: string) => {
      submit(`I want the ${type} option for my return`);
    },
    [submit],
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      switch (item.kind) {
        case 'message':
          return <MessageBubble message={item.data} />;
        case 'thinking':
          return <AgentThinking />;
        case 'ui': {
          const { name, props } = item.data;
          return (
            <View style={s.genUiWrap}>
              {name === 'product-grid' && (
                <ProductGrid
                  products={props.products ?? []}
                  loading={props.loading}
                  onAddToCart={handleAddToCart}
                />
              )}
              {name === 'order-list' && (
                <OrderList orders={props.orders ?? []} />
              )}
              {name === 'return-card' && (
                <ReturnCard
                  eligible={props.eligible}
                  options={props.options ?? []}
                  orderId={props.orderId ?? ''}
                  onSelect={handleReturnSelect}
                />
              )}
            </View>
          );
        }
      }
    },
    [handleAddToCart, handleReturnSelect],
  );

  const cartEvent = useMemo(
    () => uiEvents.find((e): e is import('../../store/chat.store').UIEvent<'cart-canvas'> => e.name === 'cart-canvas'),
    [uiEvents],
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>TechTrend</Text>
          <View style={s.onlineRow}>
            <View style={s.onlineDot} />
            <Text style={s.onlineText}>AI Assistant</Text>
          </View>
        </View>
        <TouchableOpacity style={s.newChatBtn} onPress={reset}>
          <Text style={s.newChatText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {isEmpty && (
        <View style={s.welcome}>
          <Text style={s.welcomeEmoji}>🛍️</Text>
          <Text style={s.welcomeTitle}>Hi {firstName}!</Text>
          <Text style={s.welcomeSub}>What are you shopping for today?</Text>
        </View>
      )}

      {!!error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠ {error}</Text>
          <TouchableOpacity onPress={() => useChatStore.getState().setError(null)}>
            <Text style={s.errorDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlashList
        ref={listRef}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item: ListItem) => item.id}
        estimatedItemSize={72}
        getItemType={(item: ListItem) => item.kind}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[4] }}
      />

      <SuggestedActions visible={isEmpty && !isStreaming} onSelect={submit} />
      <ChatInput onSubmit={submit} onStop={stop} disabled={isStreaming} />

      {cartEvent && (
        <CartSheet
          items={cartEvent.props.items ?? []}
          total={cartEvent.props.total ?? 0}
          onCheckout={handleCheckout}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    ...shadow.sm,
  },
  headerTitle: {
    fontSize: font.size.xl,
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  onlineText: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    fontFamily: font.family,
  },
  newChatBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newChatText: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontFamily: font.family,
    fontWeight: '500',
  },
  welcome: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 120,
    pointerEvents: 'none',
  },
  welcomeEmoji: {
    fontSize: 52,
    marginBottom: spacing[4],
  },
  welcomeTitle: {
    fontSize: font.size['2xl'],
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
  },
  welcomeSub: {
    fontSize: font.size.base,
    color: colors.textMuted,
    fontFamily: font.family,
    marginTop: spacing[2],
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.errorBg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    borderRadius: 10,
  },
  errorText: {
    fontSize: font.size.sm,
    color: colors.error,
    fontFamily: font.family,
    flex: 1,
  },
  errorDismiss: {
    fontSize: font.size.base,
    color: colors.error,
    marginLeft: spacing[2],
  },
  genUiWrap: {
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
});
