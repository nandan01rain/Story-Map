import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import ChapterDrawerScreen from '../screens/ChapterDrawerScreen';
import ChapterListScreen from '../screens/ChapterListScreen';
import EditorScreen from '../screens/EditorScreen';
import LandingScreen from '../screens/LandingScreen';
import ReaderScreen from '../screens/ReaderScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/SignInScreen';
import StickyNotesScreen from '../screens/StickyNotesScreen';
import { useAuthStore } from '../store/authStore';
import { FONTS, useTheme } from '../theme';
import type { SignedInStackParamList } from './types';

// Mirrors the PWA's own auth-driven screen flow (index.html: auth-screen -> project-
// screen -> app root, driven by sbClient.auth.onAuthStateChange). Signed-in navigation
// (ProjectPicker -> ChapterList -> ChapterDrawer -> Editor) is a single native stack,
// unlike the PWA's single-page show/hide-panel approach -- React Navigation gives us
// back-gesture/back-button behavior for free this way.
const Stack = createNativeStackNavigator<SignedInStackParamList>();
const AuthStack = createNativeStackNavigator();

export default function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const { mode, colors } = useTheme();

  const navTheme = {
    ...(mode === 'day' ? DefaultTheme : DarkTheme),
    colors: { ...(mode === 'day' ? DefaultTheme : DarkTheme).colors, background: colors.bg, card: colors.panel, border: colors.border, text: colors.text },
  };

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <Stack.Navigator
          screenOptions={{ headerTintColor: colors.gold, headerTitleStyle: { fontFamily: FONTS.heading, fontSize: 17 } }}
        >
          {/* The landing page owns this route now -- the project picker is one tab inside
              it (see LandingScreen), so every existing navigate('ProjectPicker') still
              lands in the right place. */}
          <Stack.Screen name="ProjectPicker" component={LandingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChapterList" component={ChapterListScreen} options={{ title: '' }} />
          <Stack.Screen name="ChapterDrawer" component={ChapterDrawerScreen} options={{ title: 'Chapter' }} />
          <Stack.Screen name="Editor" component={EditorScreen} options={{ title: '' }} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="StickyNotes" component={StickyNotesScreen} options={{ title: '' }} />
          <Stack.Screen name="Search" component={SearchScreen} />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
