import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { colors, spacing, radius } from '../../lib/theme';

function Dot({ delay }: { delay: number }) {
  const opacity = useSharedValue(1);
  useEffect(() => { opacity.value = withDelay(delay, withRepeat(withSequence(withTiming(0.25, { duration: 350 }), withTiming(1, { duration: 350 })), -1, false)); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: 0.7 + opacity.value * 0.3 }] }));
  return <Animated.View style={[s.dot, style]} />;
}

export function AgentThinking() {
  return (
    <View style={s.row}>
      <View style={s.avatar}><Animated.Text style={s.avatarText}>TT</Animated.Text></View>
      <View style={s.bubble}><Dot delay={0} /><Dot delay={180} /><Dot delay={360} /></View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  avatar: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.xl, borderBottomLeftRadius: 4, paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderWidth: 1, borderColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary },
});
