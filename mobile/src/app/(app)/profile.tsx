import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth.store';
import { useChatStore } from '../../store/chat.store';
import { colors, font, spacing, radius, shadow } from '../../lib/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const reset = useChatStore(s => s.reset);

  const handleSignOut = async () => {
    reset();
    await signOut();
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Profile</Text>
      </View>
      <View style={s.body}>
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.email}>{user?.email}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Row label="Account type" value={user?.role ?? '–'} />
          <Row label="User ID" value={`#${user?.id?.slice(-8).toUpperCase() ?? '–'}`} />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={r.row}>
      <Text style={r.label}>{label}</Text>
      <Text style={r.value}>{value}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  label: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontFamily: font.family,
  },
  value: {
    fontSize: font.size.sm,
    fontWeight: '600',
    color: colors.text,
    fontFamily: font.family,
  },
});

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
    padding: spacing[5],
    gap: spacing[4],
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadow.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: font.size.xl,
    fontWeight: '700',
    fontFamily: font.family,
  },
  name: {
    fontSize: font.size.lg,
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
  },
  email: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    fontFamily: font.family,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    ...shadow.sm,
  },
  signOutBtn: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  signOutText: {
    color: colors.error,
    fontSize: font.size.base,
    fontWeight: '700',
    fontFamily: font.family,
  },
});
