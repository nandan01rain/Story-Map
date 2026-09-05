import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createElement } from 'react';

// Shared color + font tokens so every screen draws from the same palette/typography
// instead of re-hardcoding hex values.
// Font roles mirror the PWA's --font-* tokens (index.html:22-34) one-for-one:
//   display  = the single large app-title use
//   heading  = section headings, act/book labels, brand text, modal titles
//   body     = default UI text, buttons, form inputs -- SERIF, matching the PWA
//   literary = chapter/scene titles, prose-adjacent text (node labels, ledger, POV)
//   mono     = badges, counts, meta/label text
// Loaded via @expo-google-fonts/* in App.tsx (useFonts) -- these string keys are the
// exact export names those packages register the fonts under. Fonts don't change with
// day/night -- only ThemeColors below does.
// PARITY WITH THE PWA IS THE POINT (2026-08-30). The two apps are one design, and the
// visual pass that moved the PWA to a serif interface never reached here -- every redesign
// commit touched index.html alone. The palettes were already the same to the byte; the
// divergence was entirely typography, which is why the app read as "the old look" while its
// colours were identical.
//
// So `body` is Spectral, not Inter. That is the PWA's --font-body, and because App.tsx sets
// a global <Text> default from it, this one line changes the face of every screen at once --
// which is exactly what parity requires and why it is worth stating loudly.
export const FONTS = {
  display: 'Cinzel_700Bold',
  heading: 'Cinzel_600SemiBold',
  headingBold: 'Cinzel_700Bold',
  body: 'Spectral_400Regular',
  bodyMedium: 'Spectral_500Medium',
  bodySemiBold: 'Spectral_600SemiBold',
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
  /**
   * The navigation bar across the top. Its own token rather than `panel`, which React
   * Navigation's theme was previously handing it: `panel` is also every card and sheet in
   * the app, so tuning the bar through it repaints surfaces that have nothing to do with
   * the bar. Both values are SAMPLED from the drawer artwork (see below) -- the bar sits
   * directly above the plates and a shade chosen independently of them reads as plain.
   */
  chrome: string;
  /**
   * The nav drawer, which is the one surface that changes MATERIAL rather than shade.
   * At night it is cream paper laid on a blue page; by day it is olive with gold lettering
   * on cream. The inversion is the same in both directions, which is what makes them read
   * as one design at two hours rather than as two designs.
   */
  rail: string;
  railInk: string;
  railDim: string;
};

// Night is the app's original, still-default look: dark brown/leather with gold
// headings and light parchment-toned body text -- unchanged by this feature. Day swaps
// only the two structural roles (surface, text) to white/cream and dark brown/black per
// explicit instruction; gold/error and every icon color stay identical in both palettes,
// also per instruction -- nothing consumes a raw gold/error hex anymore except this file,
// so "keep gold as-is" is enforced by construction, not by convention.
// Night is ROYAL BLUE, not brown (2026-08-30), matching the PWA token for token. The
// leather-and-lamplight reading was one note all the way down and gave the gold nothing to
// sit against; it also fought the sign-in artwork, which has always been a blue night. The
// braid is drawn on this same midnight, so opening it no longer changes the temperature of
// the whole screen.
export const NIGHT_COLORS: ThemeColors = {
  bg: '#0d1533',
  panel: '#17224c',
  border: '#33447c',
  borderDim: '#1e2b5c',
  text: '#e9e2ce',
  textDim: '#9dabcd',
  textFaint: '#7c88a8',
  gold: '#c69a3a',
  error: '#b8542e',
  // The night city's own sky, sampled a quarter of the way down it. Deeper and cooler than
  // the `#17224c` panel the bar used to borrow -- that was a violet navy belonging to
  // nothing on screen, which is what made the bar read as plain against the artwork. The
  // header keeps its bottom hairline (`border`), so sitting close to `bg` in value costs it
  // no definition.
  chrome: '#0c1f38',
  // BOTH drawers are parchment now (2026-09-05): day and night are the same two plates with
  // a sun or a crescent over the rose, so they are one object at two hours rather than two
  // objects. The cream is the plate's OWN bottom edge, read back off the ENCODED header's last
  // row by scripts/build-drawer-plates.py, which prints both values when it runs. That row is
  // uniform because the plate's bottom 30% is cross-faded to the rail -- which is also what
  // stops the vine borders ending on a hard line -- the panel matches the paper, the paper does not
  // match the panel. That is what lets the header stop and the rail start with nothing drawn
  // over the join.
  rail: '#efdcb5',
  // Gold in both modes. The app's #c69a3a reads at 2.3:1 on parchment -- gold in name, grey
  // in effect -- so this is the same hue carried down to 4.1:1: legibly gold rather than
  // nominally gold.
  railInk: '#7d5f2c',
  railDim: '#a89268',
};

// Day is parchment: a cream page with OLIVE chrome and GOLD lettering on it. Body ink stays
// dark on the cream, because gold text at reading size on cream is a legibility problem
// dressed up as a decision -- the gold belongs on the olive, where it has something to hold.
export const DAY_COLORS: ThemeColors = {
  bg: '#faf3e0',
  panel: '#efe4c6',
  border: '#cdbb8e',
  borderDim: '#e4d6ab',
  text: '#2c2011',
  textDim: '#6b5d42',
  textFaint: '#8a7355',
  gold: '#c69a3a',
  error: '#b8542e',
  // The day plate's paper at mid-height, where its own vignette runs a shade deeper than the
  // flat rail. Deeper on purpose: level with the rail the bar and the drawer would be one
  // undifferentiated sheet, and a header band slightly darker than the page under it is what
  // makes it read as a band at all.
  chrome: '#e6d2a4',
  // Day's drawer is the same parchment as night's, sampled the same way from its own plate
  // (drawer-day-header.webp, flat bottom edge). The olive drawer is gone with the single
  // full-height plate it belonged to; see NIGHT_COLORS for why the sampling matters.
  rail: '#efddb1',
  railInk: '#7d5f2c',
  railDim: '#a08a5e',
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
