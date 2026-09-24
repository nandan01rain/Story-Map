import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../components/Icon';
import { type TimeOfDay, useSceneMode } from '../lib/timeOfDay';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { FONTS, NIGHT_COLORS } from '../theme';
import { loadLastBackup, useBackup } from '../lib/backup';
import { promptRestore } from '../lib/restore';
import { loadLastProject } from '../lib/writingPrefs';
import { useWritingStats } from '../lib/writingStats';
import { useChapterStore } from '../store/chapterStore';
import ProjectPickerScreen from './ProjectPickerScreen';
import SearchScreen from './SearchScreen';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProjectPicker'>;
type TabKey = 'home' | 'projects' | 'explore' | 'profile';

const WORDMARK_DARK = require('../../assets/env/wordmark-dark.webp');
const WORDMARK_GOLD = require('../../assets/env/wordmark-gold.webp');

// The PWA's landing page has one fixed light "parchment card" palette. Here it is three,
// picked by real time of day the same way the sign-in scene is (lib/timeOfDay): parchment
// by day, warm amber through the sunrise/sunset window, and at night THE APP'S OWN NIGHT --
// taken from NIGHT_COLORS rather than written here, because this page hands over to the
// project picker on its Projects tab and that screen draws with the theme: a night palette
// of its own put a brown tab bar under a navy list (2026-09-19). Night is royal blue since
// 2026-08-30 (theme.ts has the reasoning); the leather this used to be predates that. Gold
// is the same in all three -- it is the app's constant.
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
    bg: NIGHT_COLORS.bg,
    card: NIGHT_COLORS.panel,
    border: NIGHT_COLORS.border,
    text: NIGHT_COLORS.text,
    dim: NIGHT_COLORS.textDim,
    gold: NIGHT_COLORS.gold,
    // The same sampled sky the navigation bar wears, so the two bars agree.
    bar: NIGHT_COLORS.chrome,
    wordmark: WORDMARK_GOLD,
  },
};

const GREETINGS: Record<TimeOfDay, string> = {
  day: 'Good day',
  sunset: 'Good evening',
  // Not "Good night": that is what you say on the way out, and the writer is arriving.
  night: 'Good evening',
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
// screen means neither has to change. Explore is the search screen with no project given:
// every project at once. (It was a placeholder until 2026-09-24, as it still is in the PWA.)
export default function LandingScreen({ navigation, route }: Props) {
  const [tab, setTab] = useState<TabKey>('home');
  const timeOfDay = useSceneMode();
  const palette = PALETTES[timeOfDay];
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette, insets.bottom), [palette, insets.bottom]);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email?.split('@')[0] || '';

  // The day's target, for the project last opened. The stats are per project and this page
  // is above the project list, so "last opened" is the one that means anything here. Its
  // chapters are fetched (cache-first) if the store is empty, since the stats refuse to
  // count a project that is not loaded.
  const [lastProject, setLastProject] = useState<{ id: string; name: string } | null>(null);
  const stats = useWritingStats();
  const backup = useBackup();
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadLastProject().then(async (p) => {
      if (cancelled || !p) return;
      setLastProject(p);
      const store = useChapterStore.getState();
      if (!store.chapters.some((c) => c.project_id === p.id)) await store.fetchChapters(p.id);
      await stats.setProject(p.id);
      await stats.recount();
      setLastBackupAt(await loadLastBackup(p.id));
    });
    if (!backup.ready) void backup.load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const showTarget = !!lastProject && stats.ready && stats.projectId === lastProject.id;
  const todayMet = stats.target > 0 && stats.todayWords >= stats.target;

  async function backupNow() {
    if (!lastProject) return;
    setBackupBusy(true);
    const { error } = await backup.backupProject(lastProject.id);
    setBackupBusy(false);
    if (error) Alert.alert('Backup did not finish', error);
    else setLastBackupAt(Date.now());
  }
  async function pickBackupFolder() {
    const { error } = await backup.chooseFolder();
    if (error) Alert.alert('No folder', error);
    else if (lastProject) void backupNow();
  }

  // The route that reaches Google Drive. Drive's own provider will not hand out a folder to
  // the picker above, so a backup gets there as a FILE through the share sheet instead.
  async function saveBackupFile() {
    if (!lastProject) return;
    setBackupBusy(true);
    const { error } = await backup.shareSnapshot(lastProject.id);
    setBackupBusy(false);
    if (error) Alert.alert('Backup did not finish', error);
    else setLastBackupAt(Date.now());
  }

  // Additive and idempotent, into a NEW project -- see lib/restore.ts. Confirmed against
  // what the file actually contains, because a backup is only worth what it still holds.
  async function restoreFromFile() {
    if (user) await promptRestore(user.id, setBackupBusy);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {/* Today's words against the target, top right, on every tab. Tapping it opens the
            full picture under Profile. */}
        {showTarget && (
          <Pressable style={styles.targetPill} onPress={() => setTab('profile')} hitSlop={6}>
            <Text style={[styles.targetPillCount, todayMet && styles.targetPillMet]}>
              {stats.todayWords.toLocaleString()}
              {stats.target > 0 ? ` / ${stats.target.toLocaleString()}` : ''}
            </Text>
            <Text style={styles.targetPillLabel}>
              {stats.target > 0 ? (stats.streak > 0 ? `today · ${stats.streak}-day streak` : 'today') : 'today · no target'}
            </Text>
          </Pressable>
        )}

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

            {/* One tap back to the manuscript. The project's chapter list goes underneath the
                Writer, so back from the page lands inside the project, not here. */}
            {lastProject && (
              <Pressable
                style={styles.primaryCard}
                onPress={() => {
                  navigation.navigate('ChapterList', { projectId: lastProject.id, projectName: lastProject.name });
                  navigation.navigate('Writer', { projectId: lastProject.id });
                }}
              >
                <Icon name="feather" size={22} color={palette.gold} />
                <View style={styles.primaryCardText}>
                  <Text style={styles.cardTitle}>Continue writing</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {lastProject.name}, where you left off.
                  </Text>
                </View>
              </Pressable>
            )}

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

        {/* Search across every project at once: the project search with no project given.
            Draws with the theme, like the Projects tab beside it. */}
        {tab === 'explore' && (
          <SearchScreen
            navigation={navigation as unknown as ComponentProps<typeof SearchScreen>['navigation']}
            route={{ key: 'explore', name: 'Search', params: undefined }}
          />
        )}

        {tab === 'profile' && (
          <ScrollView contentContainerStyle={styles.homeContent}>
            <Text style={styles.greeting}>{displayName || 'Your account'}</Text>
            <Text style={styles.cardMeta}>{user?.email ?? ''}</Text>

            {/* The writing habit: today, the streak, the target and the reminder. */}
            <Pressable
              style={styles.primaryCard}
              onPress={() => lastProject && navigation.navigate('WritingGoals', { projectId: lastProject.id })}
              disabled={!lastProject}
            >
              <Icon name="flag" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Writing goals</Text>
                <Text style={styles.cardMeta}>
                  {!lastProject
                    ? 'Open a project to start counting.'
                    : stats.target > 0
                      ? `${stats.todayWords.toLocaleString()} of ${stats.target.toLocaleString()} today · ${stats.streak}-day streak · best ${stats.best}`
                      : `${lastProject.name} · no daily target set`}
                </Text>
              </View>
            </Pressable>

            {/* The copy that reaches anywhere: one file, through the share sheet. This is
                the Google Drive route -- Drive will not give the folder picker a folder. */}
            <Pressable style={styles.primaryCard} onPress={saveBackupFile} disabled={backupBusy || !lastProject}>
              <Icon name="download" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Save a backup file</Text>
                <Text style={styles.cardMeta}>
                  {!lastProject
                    ? 'Open a project first.'
                    : backupBusy || backup.running
                      ? 'Building…'
                      : lastBackupAt
                        ? `Everything in one .json — chapters, documents, pages, treatments, the braid. Last saved ${new Date(lastBackupAt).toLocaleString()}.`
                        : 'Everything in one .json — chapters, documents, pages, treatments, the braid. Send it to Drive, email it, anywhere.'}
                </Text>
              </View>
            </Pressable>

            {/* The automatic copy. A folder on the phone or one a sync app watches. */}
            <Pressable style={styles.primaryCard} onPress={backup.folderUri ? backupNow : pickBackupFolder} disabled={backupBusy}>
              <Icon name="folder" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>{backup.folderUri ? 'Backup folder' : 'Mirror to a folder'}</Text>
                <Text style={styles.cardMeta}>
                  {!backup.folderUri
                    ? 'Pick a folder on this phone and every save mirrors there automatically. Google Drive can’t be picked here — use the backup file above for Drive.'
                    : backupBusy || backup.running
                      ? 'Backing up…'
                      : backup.error
                        ? `Last attempt failed: ${backup.error}`
                        : lastBackupAt
                          ? `Mirrored ${new Date(lastBackupAt).toLocaleString()}. Tap to back up now.`
                          : 'Tap to back up now.'}
                </Text>
              </View>
            </Pressable>
            {backup.folderUri && (
              <Pressable onPress={pickBackupFolder} hitSlop={8} style={styles.linkRow}>
                <Text style={styles.linkText}>Change folder</Text>
              </Pressable>
            )}

            <Pressable style={styles.primaryCard} onPress={restoreFromFile} disabled={backupBusy}>
              <Icon name="upload" size={22} color={palette.gold} />
              <View style={styles.primaryCardText}>
                <Text style={styles.cardTitle}>Restore from a backup</Text>
                <Text style={styles.cardMeta}>Reads a .json back in, into a new project. Nothing you have now is changed or deleted.</Text>
              </View>
            </Pressable>

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
    targetPill: { position: 'absolute', top: 10, right: 16, zIndex: 2, alignItems: 'flex-end' },
    targetPillCount: { color: palette.text, fontFamily: FONTS.headingBold, fontSize: 15, letterSpacing: 1 },
    targetPillMet: { color: palette.gold },
    targetPillLabel: { color: palette.dim, fontFamily: FONTS.body, fontSize: 10.5, marginTop: 1 },
    linkRow: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 4, marginTop: -6 },
    linkText: { color: palette.dim, fontFamily: FONTS.body, fontSize: 12, textDecorationLine: 'underline' },
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
