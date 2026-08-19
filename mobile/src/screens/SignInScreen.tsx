import { useEffect, useMemo, useState } from 'react';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthEnvironment from '../components/AuthEnvironment';
import { useTimeOfDay } from '../lib/timeOfDay';
import { useAuthStore } from '../store/authStore';
import { FONTS } from '../theme';

const SHEET_DURATION = 260;
// The card sits on painted artwork in all three time modes, so its own palette is fixed
// dark-on-warm rather than following the app's day/night theme -- a cream card would
// disappear into the day scene's sky.
const CARD_BG = 'rgba(18,13,8,0.92)';
const CARD_BORDER = '#c69a3a';
const CARD_TEXT = '#e9dcb8';
const CARD_DIM = '#a8926a';

// Ports the PWA's sign-in screen: full-bleed living environment (see AuthEnvironment) with
// the form hidden until asked for. Opens showing just the scene; a tap anywhere, or a
// swipe up, raises the sign-in sheet; a tap on the scene or a swipe down puts it away
// again. The scene itself is day/sunrise-sunset/night on real time (see lib/timeOfDay).
//
// OAuth buttons are still deliberately absent: they are inert in the PWA too (no provider
// apps registered yet, see the handoff doc), and dead UI is worse than none.
export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timeOfDay = useTimeOfDay();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(insets.bottom), [insets.bottom]);

  const sheet = useSharedValue(0);
  useEffect(() => {
    sheet.value = withTiming(revealed ? 1 : 0, { duration: SHEET_DURATION });
  }, [revealed, sheet]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheet.value) * 620 }],
    opacity: sheet.value,
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: 1 - sheet.value }));

  const revealGesture = Gesture.Pan()
    .activeOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationY < -30) runOnJS(setRevealed)(true);
      else if (e.translationY > 30) runOnJS(setRevealed)(false);
    });

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
    <View style={styles.screen}>
      <AuthEnvironment mode={timeOfDay} />

      <GestureDetector gesture={revealGesture}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setRevealed((r) => !r)}>
          <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
            <Text style={styles.hintText}>Tap to sign in</Text>
          </Animated.View>
        </Pressable>
      </GestureDetector>

      <KeyboardAvoidingView
        style={styles.sheetHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.card, sheetStyle]} pointerEvents={revealed ? 'auto' : 'none'}>
          <View style={styles.grabber} />

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#6b5d42"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#6b5d42"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!info && <Text style={styles.info}>{info}</Text>}

          <Pressable style={styles.submit} onPress={handleSubmit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#120d08" />
            ) : (
              <Text style={styles.submitText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.toggle}>
              {mode === 'signin' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#120d08' },
    hint: { position: 'absolute', left: 0, right: 0, bottom: 56 + bottomInset, alignItems: 'center' },
    hintText: {
      color: '#fff',
      fontFamily: FONTS.mono,
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    sheetHost: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
    card: {
      backgroundColor: CARD_BG,
      borderTopWidth: 1,
      borderTopColor: CARD_BORDER,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 28 + bottomInset,
    },
    grabber: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: CARD_DIM, marginBottom: 18 },
    field: { marginBottom: 14 },
    label: {
      color: CARD_DIM,
      fontFamily: FONTS.mono,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    input: {
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderWidth: 1,
      borderColor: '#4a3a22',
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: CARD_TEXT,
      fontSize: 15,
    },
    error: { color: '#e0764a', fontSize: 12.5, marginBottom: 8 },
    info: { color: CARD_DIM, fontSize: 12.5, marginBottom: 8 },
    submit: {
      backgroundColor: CARD_BORDER,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    submitText: { color: '#120d08', fontFamily: FONTS.headingBold, fontSize: 15, letterSpacing: 1 },
    toggle: { color: CARD_DIM, fontSize: 13, textAlign: 'center', marginTop: 16 },
  });
}
