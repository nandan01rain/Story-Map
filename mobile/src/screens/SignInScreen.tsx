import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AuthEnvironment from '../components/AuthEnvironment';
import { AppleMark, GoogleMark, MicrosoftMark } from '../components/BrandIcons';
import Icon from '../components/Icon';
import { useSceneMode } from '../lib/timeOfDay';
import { useAuthStore } from '../store/authStore';
import { FONTS } from '../theme';

const DIRECTIONS = require('../../assets/env/directions.webp');

// Glass, not a solid sheet: the card has no background of its own, only translucent
// fields and buttons, so the artwork reads straight through it. Everything on it is
// white or gold -- the palette has to work over whatever part of the painting happens to
// sit behind it, which rules out the app's usual ink-on-parchment scheme.
const WHITE = '#fff';
const WHITE_80 = 'rgba(255,255,255,0.8)';
const WHITE_75 = 'rgba(255,255,255,0.75)';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const HAIRLINE = 'rgba(255,255,255,0.35)';
const GOLD = '#d99a2b';

// Ports the PWA's sign-in screen. Opens on the living environment alone (see
// AuthEnvironment) with a blinking hint; a swipe up or a tap raises the form, a swipe
// down or a tap on the scenery puts it away.
export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timeOfDay = useSceneMode();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(insets.bottom), [insets.bottom]);

  const sheet = useSharedValue(0);
  useEffect(() => {
    // Same curve as the PWA's .35s cubic-bezier(.22,.61,.36,1) -- a quick departure that
    // eases into place, rather than a symmetric slide.
    sheet.value = withTiming(revealed ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
    });
  }, [revealed, sheet]);

  const blink = useSharedValue(0.5);
  useEffect(() => {
    blink.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [blink]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheet.value) * 460 }],
    opacity: sheet.value,
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: (1 - sheet.value) * blink.value }));

  const swipe = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationY < -28) runOnJS(setRevealed)(true);
      else if (e.translationY > 28) runOnJS(setRevealed)(false);
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

      {/* The scenery layer: swipe anywhere on it, or tap it, to raise or drop the card. */}
      <GestureDetector gesture={swipe}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setRevealed((r) => !r)}>
          <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
            <Text style={styles.hintText}>Tap to sign in</Text>
          </Animated.View>
        </Pressable>
      </GestureDetector>

      {/* A screen-corner element rather than part of the scene, so it stays anchored to
          the viewport instead of to the artwork -- locking it to the stage would push it
          out of frame on a wide screen. */}
      <View style={styles.directions} pointerEvents="none">
        <Image source={DIRECTIONS} resizeMode="contain" style={styles.directionsImage} />
      </View>

      <KeyboardAvoidingView
        style={styles.sheetHost}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.card, sheetStyle]} pointerEvents={revealed ? 'auto' : 'none'}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Icon name="mail" size={14} color={WHITE_85} />
              </View>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
            </View>

            <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Icon name="lock" size={14} color={WHITE_85} />
              </View>
              <TextInput
                style={[styles.input, styles.inputWithAction]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
              <Pressable style={styles.inputAction} onPress={() => setShowPassword((s) => !s)} hitSlop={6}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} color={WHITE_85} />
              </Pressable>
            </View>

            <View style={styles.optionsRow}>
              <Pressable style={styles.rememberRow} onPress={() => setRemember((r) => !r)} hitSlop={6}>
                <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                  {remember && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable onPress={handleForgot} hitSlop={6}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!info && <Text style={styles.info}>{info}</Text>}

            <Pressable style={styles.submit} onPress={handleSubmit} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.submitText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Present but inert, exactly as in the PWA: the providers still need OAuth
                apps registered and enabled in Supabase before these can do anything. */}
            <Pressable style={styles.oauthBtn} onPress={handleOAuthUnavailable}>
              <GoogleMark />
              <Text style={styles.oauthText}>Continue with Google</Text>
            </Pressable>
            <Pressable style={styles.oauthBtn} onPress={handleOAuthUnavailable}>
              <AppleMark />
              <Text style={styles.oauthText}>Continue with Apple</Text>
            </Pressable>
            <Pressable style={styles.oauthBtn} onPress={handleOAuthUnavailable}>
              <MicrosoftMark />
              <Text style={styles.oauthText}>Continue with Microsoft</Text>
            </Pressable>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
              </Text>
              <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} hitSlop={6}>
                <Text style={styles.toggleLink}>{mode === 'signin' ? 'Create one' : 'Sign in'}</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Terms <Text style={styles.footerSep}>✦</Text> Privacy <Text style={styles.footerSep}>✦</Text> Contact
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );

  async function handleForgot() {
    if (!email.trim()) {
      setError('Enter your email above first, then tap "Forgot password?".');
      return;
    }
    setError('');
    setInfo('Sending reset link…');
    const { error: err } = await useAuthStore.getState().resetPassword(email.trim());
    setInfo(err ? '' : 'Check your email for a password reset link.');
    if (err) setError(err);
  }

  function handleOAuthUnavailable() {
    setInfo('');
    setError('Social sign-in isn’t connected yet — use your email and password.');
  }
}

function makeStyles(bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#120d08' },
    hint: { position: 'absolute', left: 0, right: 0, bottom: 56 + bottomInset, alignItems: 'center' },
    hintText: {
      color: WHITE,
      fontFamily: FONTS.mono,
      fontSize: 12,
      letterSpacing: 1,
      textTransform: 'uppercase',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    directions: { position: 'absolute', right: 34, bottom: 72 + bottomInset, width: 56, height: 56, opacity: 0.85 },
    directionsImage: { width: '100%', height: '100%' },
    sheetHost: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
    card: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 296,
      maxHeight: '68%',
      paddingHorizontal: 16,
      paddingVertical: 20,
      marginBottom: 16 + bottomInset,
      borderRadius: 16,
    },
    label: {
      fontFamily: FONTS.mono,
      fontSize: 10,
      color: WHITE_80,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    labelSpaced: { marginTop: 11 },
    inputWrap: { position: 'relative', justifyContent: 'center' },
    inputIcon: { position: 'absolute', left: 11, zIndex: 1 },
    input: {
      width: '100%',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
      borderRadius: 6,
      paddingLeft: 32,
      paddingRight: 12,
      paddingVertical: 6,
      color: WHITE,
      fontSize: 16,
    },
    inputWithAction: { paddingRight: 38 },
    inputAction: { position: 'absolute', right: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    checkbox: {
      width: 15,
      height: 15,
      borderRadius: 3,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
    checkmark: { color: WHITE, fontSize: 10, lineHeight: 13 },
    rememberText: { color: WHITE_85, fontSize: 11.5 },
    forgot: { color: WHITE, fontSize: 11.5, textDecorationLine: 'underline' },
    error: { color: '#ffb3a0', fontSize: 12, marginTop: 8, lineHeight: 17 },
    info: { color: WHITE_80, fontSize: 12, marginTop: 8, lineHeight: 17 },
    submit: {
      width: '100%',
      marginTop: 11,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: 'rgba(217,154,43,0.32)',
      borderWidth: 1.5,
      borderColor: 'rgba(217,154,43,0.85)',
    },
    submitText: { color: WHITE, fontSize: 14, fontWeight: '600' },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 11 },
    dividerLine: { flex: 1, height: 1, backgroundColor: HAIRLINE },
    dividerText: { color: 'rgba(255,255,255,0.7)', fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.6 },
    oauthBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      width: '100%',
      marginBottom: 11,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 6,
      backgroundColor: 'rgba(250,243,228,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(217,195,156,0.6)',
    },
    oauthText: { color: WHITE, fontSize: 13, fontWeight: '500' },
    toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 4 },
    toggleText: { color: WHITE_80, fontSize: 11.5 },
    toggleLink: { color: GOLD, fontSize: 11.5, textDecorationLine: 'underline' },
    footer: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: HAIRLINE, alignItems: 'center' },
    footerText: { color: WHITE_75, fontSize: 10.5 },
    footerSep: { color: 'rgba(217,195,156,0.6)' },
  });
}
