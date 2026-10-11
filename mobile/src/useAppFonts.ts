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
  Spectral_600SemiBold,
} from '@expo-google-fonts/spectral';
import { Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
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
  Spectral_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    // Handwriting, for the storyboard wall and scene sketches (2026-10-11): Caveat for titles
    // and labels, Patrick Hand -- the more legible of the two -- for anything read at length.
    Caveat_600SemiBold,
    Caveat_700Bold,
    PatrickHand_400Regular,
  });
}
