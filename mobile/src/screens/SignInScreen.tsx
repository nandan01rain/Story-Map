import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '../store/authStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

// Phase-1 scope: plain email/password form only. The PWA's OAuth buttons are inert
// there too (no provider apps registered yet, see handoff doc) — not worth porting
// dead UI, add them for real once OAuth is actually wired up on the backend side.
export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleSubmit() {
    setError('');
    setInfo('');
    setBusy(true);
    const { error: err } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === 'signup') {
      setInfo('Check your email to confirm your account, then sign in.');
      setMode('signin');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>StoryMap</Text>
      <Text style={styles.tagline}>Chart the past. Shape the future.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textFaint}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="Enter your password"
          placeholderTextColor={colors.textFaint}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#2b1a05" />
        ) : (
          <Text style={styles.submitText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.toggle}>
          {mode === 'signin' ? "Need an account? " : 'Have an account? '}
          <Text style={styles.toggleLink}>{mode === 'signin' ? 'Create one' : 'Sign in'}</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' },
    title: { fontFamily: FONTS.display, fontSize: 32, color: colors.text, textAlign: 'center' },
    tagline: {
      fontFamily: FONTS.literaryItalic,
      fontSize: 13,
      color: colors.textDim,
      textAlign: 'center',
      marginBottom: 32,
      fontStyle: 'italic',
    },
    field: { marginBottom: 14 },
    label: { fontFamily: FONTS.mono, fontSize: 10.5, color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
    input: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 11,
      fontSize: 16,
      color: colors.text,
    },
    error: { color: colors.error, fontSize: 12, marginBottom: 10 },
    info: { color: '#2f9d8a', fontSize: 12, marginBottom: 10 },
    submitBtn: { backgroundColor: colors.gold, borderRadius: 6, padding: 13, alignItems: 'center', marginTop: 6 },
    submitText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
    toggle: { color: colors.textDim, fontSize: 12, textAlign: 'center', marginTop: 18 },
    toggleLink: { color: colors.gold, textDecorationLine: 'underline' },
  });
}
