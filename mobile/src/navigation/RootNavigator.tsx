import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import ProjectPickerScreen from '../screens/ProjectPickerScreen';
import SignInScreen from '../screens/SignInScreen';
import { useAuthStore } from '../store/authStore';

// Mirrors the PWA's own auth-driven screen flow (index.html: auth-screen -> project-
// screen -> app root, driven by sbClient.auth.onAuthStateChange). The map/list/editor
// screens land inside the signed-in stack in a later phase, alongside ProjectPicker.
const Stack = createNativeStackNavigator();

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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="ProjectPicker" component={ProjectPickerScreen} />
        ) : (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
