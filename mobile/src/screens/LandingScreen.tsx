import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import { type TimeOfDay, useTimeOfDay } from '../lib/timeOfDay';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { FONTS } from '../theme';
import ProjectPickerScreen from './ProjectPickerScreen';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProjectPicker'>;
type TabKey = 'home' | 'projects' | 'explore' | 'profile';

const WORDMARK_DARK = require('../../assets/env/wordmark-dark.webp');
const WORDMARK_GOLD = require('../../assets/env/wordmark-gold.webp');

// The PWA's landing page has one fixed light "parchment card" palette. Here it is three,
// picked by real time of day the same way the sign-in scene is (lib/timeOfDay): parchment
// by day, warm amber through the sunrise/sunset window, deep leather at night. Gold is the
// same in all three -- it is the app's constant, exactly as in the day/night theme.
type LandingPalette = {
  bg: string;
  card: string;
  border: string;
  text: string;
  dim: string;
  gold: string;
  bar: string;
  wordmark: number;
};

const PALETTES: Record<TimeOfDay, LandingPalette> = {
  day: {
    bg: '#faf3e0',
    card: '#fffaf0',
    border: '#e0cfa0',
    text: '#2c2011',
    dim: '#6b5d42',
    gold: '#c69a3a',
    bar: '#fffaf0',
    wordmark: WORDMARK_DARK,
  },
  sunset: {
    bg: '#3a2418',
    card: '#4a2f1c',
    border: '#8a5a3a',
    text: '#f7e6c8',
    dim: '#d3a97c',
    gold: '#f2a94e',
    bar: '#33200f',
    wordmark: WORDMARK_GOLD,
  },
  night: {
    bg: '#120d08',
    card: '#1a130b',
    border: '#4a3a22',
    text: '#e9dcb8',
    dim: '#a8926a',
    gold: '#c69a3a',
    bar: '#0d0905',
    wordmark: WORDMARK_GOLD,
  },
};

const GREETINGS: Record<TimeOfDay, string> = {
  day: 'Good day',
  sunset: 'Good evening',
  night: 'Good night',
};

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: 'compass', label: 'Home' },
  { key: 'projects', icon: 'books', label: 'Projects' },
  { key: 'explore', icon: 'search', label: 'Explore' },
  { key: 'profile', icon: 'gear', label: 'Profile' },
];

// Ports the PWA's landing page: a bottom tab bar (Home / Projects / + / Explore / Profile)
// sitting above the project list, rather than dropping straight into a bare picker.
//
// Deliberately NOT a nested tab navigator -- the tabs are views of one stack screen. The
// project list needs to push ChapterList onto the parent stack, and every existing
// navigate('ProjectPicker') call in the app already points here; keeping this a single
// screen means neither has to change. Explore is a styled placeholder, exactly as in the
// PWA -- cross-project search was never built there either.
export default function LandingScreen({ navigation, route }: Props) {
  const [tab, setTab] = useState<TabKey>('home');
  const timeOfDay = useTimeOfDay();
  const palette = PALETTES[timeOfDay];
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette, insets.bottom), [palette, insets.bottom]);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email?.split('@')[0] || '';

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {tab === 'home' && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <Image source={palette.wordmark} resizeMode="contain" style={styles.wordmark} />
            <Text style={styles.greeting}>
              {GREETINGS[timeOfDay]}
              {displayName ? `, ${displayName}` : ''}
            </Text>

            <View style={styles.epigraph}>
              <Text style={styles.epigraphText}>
                Chart the past.{'\n'}Shape the future.{'\n'}Leave your legend.
              </Text>
            </View>

            <Pressable style={styles.primaryCard} onPress={() => setTab('projects')}>
              <Icon name="books" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Your projects</Text>
                <Text style={styles.cardMeta}>Open a saga and pick up where you left off.</Text>
              </View>
            </Pressable>
          </ScrollView>
        )}

        {/* Kept mounted once visited so switching tabs doesn't re-fetch the project list
            and lose an in-progress rename or drag. */}
        {tab === 'projects' && <ProjectPickerScreen navigation={navigation} route={route} />}

        {tab === 'explore' && (
          <View style={styles.placeholder}>
            <Icon name="search" size={30} color={palette.gold} />
            <Text style={styles.placeholderTitle}>Explore</Text>
            <Text style={styles.placeholderText}>
              Search across every project at once. Not built yet — for now, search within a project from its menu.
            </Text>
          </View>
        )}

        {tab === 'profile' && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <Text style={styles.greeting}>{displayName || 'Your account'}</Text>
            <Text style={styles.cardMeta}>{user?.email ?? ''}</Text>

            <Pressable style={styles.primaryCard} onPress={() => navigation.navigate('Settings')}>
              <Icon name="gear" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Settings</Text>
                <Text style={styles.cardMeta}>Appearance and screen brightness.</Text>
              </View>
            </Pressable>

            <Pressable style={styles.primaryCard} onPress={signOut}>
              <Icon name="exit" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Sign out</Text>
              </View>
            </Pressable>
          </ScrollView>
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} styles={styles} palette={palette} />
        ))}
        <Pressable style={styles.addButton} onPress={() => setTab('projects')}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.key} tab={t} active={tab === t.key} onPress={() => setTab(t.key)} styles={styles} palette={palette} />
        ))}
      </View>
    </View>
  );
}

function TabButton({
  tab,
  active,
  onPress,
  styles,
  palette,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  palette: LandingPalette;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Icon name={tab.icon} size={20} color={active ? palette.gold : palette.dim} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
    </Pressable>
  );
}

function makeStyles(palette: LandingPalette, bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg },
    body: { flex: 1 },
    homeContent: { padding: 24, paddingTop: 56 },
    wordmark: { width: '72%', height: 64, alignSelf: 'center', marginBottom: 24 },
    greeting: { color: palette.text, fontFamily: FONTS.heading, fontSize: 22, textAlign: 'center' },
    epigraph: {
      marginTop: 28,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 6,
      padding: 20,
      backgroundColor: palette.card,
    },
    epigraphText: {
      color: palette.dim,
      fontFamily: FONTS.literaryItalic,
      fontSize: 13.5,
      lineHeight: 22,
      textAlign: 'center',
    },
    primaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 18,
      padding: 18,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.card,
    },
    primaryCardText: { flex: 1 },
    cardTitle: { color: palette.text, fontFamily: FONTS.heading, fontSize: 15 },
    cardMeta: { color: palette.dim, fontSize: 12.5, marginTop: 3 },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
    placeholderTitle: { color: palette.text, fontFamily: FONTS.heading, fontSize: 18 },
    placeholderText: { color: palette.dim, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    tabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.bar,
      borderTopWidth: 1,
      borderTopColor: palette.border,
      paddingTop: 8,
      paddingBottom: 8 + bottomInset,
    },
    tab: { flex: 1, alignItems: 'center', gap: 3 },
    tabLabel: { color: palette.dim, fontFamily: FONTS.mono, fontSize: 9.5, letterSpacing: 0.4 },
    tabLabelActive: { color: palette.gold },
    addButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: palette.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -18,
    },
    addButtonText: { color: palette.bar, fontSize: 26, lineHeight: 30 },
  });
}
