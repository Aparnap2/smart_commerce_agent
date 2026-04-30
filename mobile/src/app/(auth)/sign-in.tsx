import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { colors, font, spacing, radius, shadow } from '../../lib/theme';

export default function SignInScreen() {
  const signIn = useAuthStore(s => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) { setError('Enter email and password'); return; }
    setLoading(true);
    setError('');
    try {
      await signIn(e, p);
    } catch (err: any) {
      setError(err.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoWrap}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>TT</Text>
          </View>
          <Text style={s.brand}>TechTrend</Text>
          <Text style={s.tagline}>AI-powered electronics store</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Sign in</Text>

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
            />
          </View>

          <TouchableOpacity
            style={[s.btn, loading && s.btnLoading]}
            onPress={handleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.devBtn}
          onPress={() => {
            setEmail('customer@test.com');
            setPassword('password123');
          }}
        >
          <Text style={s.devText}>🛠 Fill test credentials</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[12],
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
    ...shadow.md,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  brand: {
    fontSize: font.size['2xl'],
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
  },
  tagline: {
    fontSize: font.size.sm,
    color: colors.textMuted,
    marginTop: spacing[1],
    fontFamily: font.family,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[6],
    ...shadow.lg,
  },
  cardTitle: {
    fontSize: font.size.xl,
    fontWeight: '700',
    color: colors.text,
    fontFamily: font.family,
    marginBottom: spacing[6],
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  errorText: {
    color: colors.error,
    fontSize: font.size.sm,
    fontFamily: font.family,
  },
  field: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: font.size.sm,
    fontWeight: '500',
    color: colors.text,
    fontFamily: font.family,
    marginBottom: spacing[1],
  },
  input: {
    height: 48,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    fontSize: font.size.base,
    color: colors.text,
    fontFamily: font.family,
  },
  btn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[6],
    ...shadow.sm,
  },
  btnLoading: {
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    fontSize: font.size.base,
    fontWeight: '700',
    fontFamily: font.family,
  },
  devBtn: {
    marginTop: spacing[6],
    alignItems: 'center',
  },
  devText: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    fontFamily: font.family,
  },
});
