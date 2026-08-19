import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DropProvider } from 'react-native-reanimated-dnd';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DropProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </DropProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
