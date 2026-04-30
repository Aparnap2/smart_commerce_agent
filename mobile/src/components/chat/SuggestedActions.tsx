import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing, radius } from '../../lib/theme';
const CHIPS = ['🎧 Sony headphones', '🛒 My cart', '📦 My orders', '💰 Under ₹3000', '🔌 USB-C cables', '🔄 Return an item'];
export function SuggestedActions({ visible, onSelect }: { visible: boolean; onSelect: (s: string) => void }) {
  if (!visible) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.container}>
      {CHIPS.map(chip => (
        <TouchableOpacity key={chip} style={s.chip} onPress={async () => { await Haptics.selectionAsync(); onSelect(chip); }}>
          <Text style={s.chipText}>{chip}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
const s = StyleSheet.create({ container: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[2] }, chip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }, chipText: { fontSize: font.size.sm, color: colors.text, fontWeight: '500', fontFamily: font.family } });
