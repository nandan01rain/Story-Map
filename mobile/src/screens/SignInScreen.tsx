import { useState } from 'react';
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
          placeholderTextColor="#8a7355"
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
          placeholderTextColor="#8a7355"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#120d08', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#e9dcb8', textAlign: 'center' },
  tagline: { fontSize: 13, color: '#a8926a', textAlign: 'center', marginBottom: 32, fontStyle: 'italic' },
  field: { marginBottom: 14 },
  label: { fontSize: 10.5, color: '#a8926a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  input: {
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 11,
    fontSize: 16,
    color: '#e9dcb8',
  },
  error: { color: '#b8542e', fontSize: 12, marginBottom: 10 },
  info: { color: '#2f9d8a', fontSize: 12, marginBottom: 10 },
  submitBtn: { backgroundColor: '#c69a3a', borderRadius: 6, padding: 13, alignItems: 'center', marginTop: 6 },
  submitText: { color: '#2b1a05', fontWeight: '700', fontSize: 15 },
  toggle: { color: '#a8926a', fontSize: 12, textAlign: 'center', marginTop: 18 },
  toggleLink: { color: '#c69a3a', textDecorationLine: 'underline' },
});
