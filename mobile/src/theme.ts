import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createElement } from 'react';

// Shared color + font tokens so every screen draws from the same palette/typography
// instead of re-hardcoding hex values.
// Font roles mirror the PWA's --font-* tokens (index.html:22-34) one-for-one:
//   display  = the single large app-title use
//   heading  = section headings, act/book labels, brand text, modal titles
//   body     = default UI text, buttons, form inputs
//   literary = chapter/scene titles, prose-adjacent text (node labels, ledger, POV)
//   mono     = badges, counts, meta/label text
// Loaded via @expo-google-fonts/* in App.tsx (useFonts) -- these string keys are the
// exact export names those packages register the fonts under. Fonts don't change with
// day/night -- only ThemeColors below does.
export const FONTS = {
  display: 'CinzelDecorative_700Bold',
  heading: 'Cinzel_600SemiBold',
  headingBold: 'Cinzel_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  literary: 'Spectral_400Regular',
  literaryMedium: 'Spectral_500Medium',
  literaryItalic: 'Spectral_400Regular_Italic',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

// Full useFonts() map -- import into App.tsx so every weight actually used above is
// registered (useFonts only loads what you pass it).
export { useAppFonts } from './useAppFonts';

export type ThemeColors = {
  bg: string;
  panel: string;
  border: string;
  borderDim: string;
  text: string;
  textDim: string;
  textFaint: string;
  gold: string;
  error: string;
};

// Night is the app's original, still-default look: dark brown/leather with gold
// headings and light parchment-toned body text -- unchanged by this feature. Day swaps
// only the two structural roles (surface, text) to white/cream and dark brown/black per
// explicit instruction; gold/error and every icon color stay identical in both palettes,
// also per instruction -- nothing consumes a raw gold/error hex anymore except this file,
// so "keep gold as-is" is enforced by construction, not by convention.
export const NIGHT_COLORS: ThemeColors = {
  bg: '#120d08',
  panel: '#1a130b',
  border: '#4a3a22',
  borderDim: '#2a2013',
  text: '#e9dcb8',
  textDim: '#a8926a',
  textFaint: '#8a7355',
  gold: '#c69a3a',
  error: '#b8542e',
};

export const DAY_COLORS: ThemeColors = {
  bg: '#faf3e0',
  panel: '#f1e6c8',
  border: '#d9c896',
  borderDim: '#ecdfb8',
  text: '#2c2011',
  textDim: '#6b5d42',
  textFaint: '#8a7355',
  gold: '#c69a3a',
  error: '#b8542e',
};

export type ThemeMode = 'day' | 'night';
// The stored/user-facing choice -- 'auto' resolves to the DEVICE'S CLOCK (real local
// time: 6am-6pm reads as day, otherwise night), not the OS's manual light/dark display
// setting -- explicit feedback that "auto" should track when it actually is, not
// whatever appearance mode the user picked in their OS settings once. `mode` below is
// always the RESOLVED value (never 'auto') -- every consumer that just wants colors
// reads `mode`/`colors`; only the Settings toggle itself needs `preference` to show
// which of the three is currently selected.
export type ThemePreference = ThemeMode | 'auto';
const THEME_STORAGE_KEY = 'app-theme-mode';
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;
const AUTO_RECHECK_INTERVAL_MS = 60_000;

function resolveModeByClock(): ThemeMode {
  const hour = new Date().getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'day' : 'night';
}

type ThemeContextValue = {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: ThemeColors;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'night',
  preference: 'night',
  colors: NIGHT_COLORS,
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('night');
  const [clockMode, setClockMode] = useState<ThemeMode>(resolveModeByClock);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'day' || saved === 'night' || saved === 'auto') setPreferenceState(saved);
    });
  }, []);

  // Only matters while "auto" is selected, but cheap enough to just always run --
  // re-checks the clock every minute so day/night actually flips when 6am/6pm arrives,
  // without needing the app to be backgrounded/foregrounded first.
  useEffect(() => {
    const id = setInterval(() => setClockMode(resolveModeByClock()), AUTO_RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  }

  const mode: ThemeMode = preference === 'auto' ? clockMode : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, colors: mode === 'day' ? DAY_COLORS : NIGHT_COLORS, setPreference }),
    [mode, preference],
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// hex (e.g. from ThemeColors) -> rgba(...) at the given alpha -- used for translucent
// chrome overlays (ReaderScreen's header/footer bands) that need to sit on top of the
// page yet still track day/night instead of being hardcoded to one fixed dark color.
export function withOpacity(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
