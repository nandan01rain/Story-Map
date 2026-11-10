import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DropProvider } from 'react-native-reanimated-dnd';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoadScreen from './src/components/LoadScreen';
import { flush } from './src/lib/outbox';
import { useWritingStats } from './src/lib/writingStats';
import { useOtaUpdate } from './src/lib/useOtaUpdate';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuthStore } from './src/store/authStore';
import { FONTS, ThemeProvider, useAppFonts, useTheme } from './src/theme';

// Global default: every <Text> not given its own fontFamily falls back to the PWA's
// --font-body (Inter) instead of the platform default, matching the "same font
// throughout the app" requirement without having to touch every existing style object.
// Screens/components still override fontFamily explicitly for heading/literary/mono
// roles (see theme.ts) the same way the PWA's CSS does per element.
const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
TextAny.defaultProps = TextAny.defaultProps ?? {};
TextAny.defaultProps.style = [{ fontFamily: FONTS.body }, TextAny.defaultProps.style];

// Theme (day/night) needs to wrap RootNavigator AND drive the OS status bar's own
// icon color, so this inner component sits inside ThemeProvider and reads useTheme --
// App itself renders before the persisted theme choice has loaded from AsyncStorage,
// which is one reason the load screen below is always beige rather than themed.
function AppShell() {
  const { mode, colors } = useTheme();
  const ota = useOtaUpdate();

  // Anything written without a network goes out when there is one. No connectivity library
  // is consulted: the queue simply tries, and a failure leaves it exactly as it was. Sending
  // on foreground covers the case that matters -- landing, and the app coming back up.
  useEffect(() => {
    void flush();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void flush();
        // The day may have turned over while the app was in the background; the streak and
        // the reminder are recomputed for it.
        if (useWritingStats.getState().ready) void useWritingStats.getState().recount();
      }
    });
    return () => sub.remove();
  }, []);
  return (
    <>
      <RootNavigator />
      {/* Offered, never forced. An update downloaded mid-sentence should not restart the app
          out from under someone -- a reload you did not ask for is indistinguishable from a
          crash. Sits at the bottom so it never covers a screen's own header. */}
      {ota.ready && (
        <Pressable
          onPress={ota.apply}
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 24,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: colors.gold,
            backgroundColor: colors.panel,
          }}
        >
          <Text style={{ color: colors.gold, fontSize: 13.5 }}>
            An update is ready — tap to restart
          </Text>
        </Pressable>
      )}
      <StatusBar style={mode === 'day' ? 'dark' : 'light'} />
    </>
  );
}

// The load screen stays over the app until the fonts are in and the session has been restored,
// and for at least MIN_LOAD -- long enough to be seen as an opening rather than a flicker.
const MIN_LOAD = 2400;

function LoadGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const initializing = useAuthStore((s) => s.initializing);
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_LOAD);
    return () => clearTimeout(t);
  }, []);

  if (gone) return null;
  return <LoadScreen ready={fontsLoaded && !initializing && minElapsed} onFinished={() => setGone(true)} />;
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {fontsLoaded && (
        <SafeAreaProvider>
          <ThemeProvider>
            <DropProvider>
              <AppShell />
            </DropProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      )}
      <LoadGate fontsLoaded={fontsLoaded} />
    </GestureHandlerRootView>
  );
}
