import { createNavigationContainerRef } from '@react-navigation/native';

import type { SignedInStackParamList } from './types';

// For the few things outside any screen that need to move between screens -- the load screen
// opening the project whose frame was tapped.
export const navigationRef = createNavigationContainerRef<SignedInStackParamList>();
