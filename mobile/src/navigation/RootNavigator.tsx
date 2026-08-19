import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import ChapterDrawerScreen from '../screens/ChapterDrawerScreen';
import ChapterListScreen from '../screens/ChapterListScreen';
import EditorScreen from '../screens/EditorScreen';
import ProjectPickerScreen from '../screens/ProjectPickerScreen';
import SignInScreen from '../screens/SignInScreen';
import { useAuthStore } from '../store/authStore';
import type { SignedInStackParamList } from './types';

// Mirrors the PWA's own auth-driven screen flow (index.html: auth-screen -> project-
// screen -> app root, driven by sbClient.auth.onAuthStateChange). Signed-in navigation
// (ProjectPicker -> ChapterList -> ChapterDrawer -> Editor) is a single native stack,
// unlike the PWA's single-page show/hide-panel approach -- React Navigation gives us
// back-gesture/back-button behavior for free this way.
const Stack = createNativeStackNavigator<SignedInStackParamList>();
const AuthStack = createNativeStackNavigator();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#120d08', card: '#1a130b', border: '#4a3a22', text: '#e9dcb8' },
};

export default function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#120d08', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#c69a3a" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      {session ? (
        <Stack.Navigator screenOptions={{ headerTintColor: '#c69a3a' }}>
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChapterList" component={ChapterListScreen} options={{ title: '' }} />
          <Stack.Screen name="ChapterDrawer" component={ChapterDrawerScreen} options={{ title: 'Chapter' }} />
          <Stack.Screen name="Editor" component={EditorScreen} options={{ title: '' }} />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignIn" component={SignInScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
