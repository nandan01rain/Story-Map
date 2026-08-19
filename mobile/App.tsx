import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DropProvider } from 'react-native-reanimated-dnd';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { FONTS, NIGHT_COLORS, ThemeProvider, useAppFonts, useTheme } from './src/theme';

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
// hence the plain NIGHT_COLORS-toned loading screen below (can't call useTheme there).
function AppShell() {
  const { mode } = useTheme();
  return (
    <>
      <RootNavigator />
      <StatusBar style={mode === 'day' ? 'dark' : 'light'} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: NIGHT_COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={NIGHT_COLORS.gold} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DropProvider>
            <AppShell />
          </DropProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
