// Must be the very first import in the entry file — gesture-handler patches native
// event handling globally and can crash (mainly on Android) if imported any later.
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto'; // supabase-js needs a real URL implementation, RN's isn't complete

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
