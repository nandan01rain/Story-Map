import {
  Cinzel_600SemiBold,
  Cinzel_700Bold,
} from '@expo-google-fonts/cinzel';
import { CinzelDecorative_700Bold } from '@expo-google-fonts/cinzel-decorative';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  Spectral_400Regular,
  Spectral_400Regular_Italic,
  Spectral_500Medium,
} from '@expo-google-fonts/spectral';
import { useFonts } from 'expo-font';

// One place registering every weight FONTS (theme.ts) references -- keep the two files
// in sync when adding a new weight/role.
export function useAppFonts() {
  return useFonts({
    CinzelDecorative_700Bold,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Spectral_400Regular,
    Spectral_400Regular_Italic,
    Spectral_500Medium,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
}
