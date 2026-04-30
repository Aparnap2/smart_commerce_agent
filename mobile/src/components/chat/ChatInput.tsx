import { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing, radius, shadow } from '../../lib/theme';

export function ChatInput({ onSubmit, onStop, disabled }: { onSubmit: (t: string) => void; onStop: () => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !disabled;
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const trimmed = text.trim(); setText('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSubmit(trimmed);
  }, [canSend, text, onSubmit]);
  return (
    <View style={s.container}>
      <View style={s.row}>
        <TextInput style={s.input} value={text} onChangeText={setText} placeholder="Ask me anything…" placeholderTextColor={colors.textFaint} multiline maxLength={600} editable={!disabled} returnKeyType="send" blurOnSubmit={false} onSubmitEditing={handleSend} />
        {disabled ? (
          <TouchableOpacity style={[s.iconBtn, s.stopBtn]} onPress={onStop}><View style={s.stopIcon} /></TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.iconBtn, !canSend && s.iconBtnOff]} onPress={handleSend} disabled={!canSend}>
            <Ionicons name="arrow-up" size={20} color={canSend ? '#fff' : colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: Platform.OS === 'ios' ? spacing[8] : spacing[2] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing[4], paddingVertical: spacing[2], fontSize: font.size.base, color: colors.text, fontFamily: font.family },
  iconBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  iconBtnOff: { backgroundColor: colors.surfaceOffset },
  stopBtn: { backgroundColor: colors.error },
  stopIcon: { width: 14, height: 14, backgroundColor: '#fff', borderRadius: 3 },
});
