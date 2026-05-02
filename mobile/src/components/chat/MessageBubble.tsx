import { useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { colors, font, spacing, radius, shadow } from '../../lib/theme';
import type { Message } from '../../store/chat.store';

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const isHuman = message.role === 'human';
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  useEffect(() => { opacity.value = withTiming(1, { duration: 180 }); translateY.value = withSpring(0, { damping: 22, stiffness: 300 }); }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: translateY.value }] }));
  return (
    <Animated.View style={[s.row, isHuman ? s.rowHuman : s.rowAgent, animStyle]}>
      {!isHuman && <View style={s.avatar}><Text style={s.avatarText}>TT</Text></View>}
      <View style={[s.bubble, isHuman ? s.bubbleHuman : s.bubbleAgent]}>
        <Text style={[s.text, isHuman ? s.textHuman : s.textAgent]}>{message.content}</Text>
      </View>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing[2], paddingHorizontal: spacing[4] },
  rowHuman: { justifyContent: 'flex-end' }, rowAgent: { justifyContent: 'flex-start', gap: spacing[2] },
  avatar: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: font.family },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  bubbleHuman: { backgroundColor: colors.primary, borderBottomRightRadius: 4, ...shadow.sm },
  bubbleAgent: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  text: { fontSize: font.size.base, lineHeight: font.size.base * 1.55, fontFamily: font.family },
  textHuman: { color: '#fff', fontWeight: '500' }, textAgent: { color: colors.text, fontWeight: '400' },
});
