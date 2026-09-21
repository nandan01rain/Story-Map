import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { ensureNotificationPermission, useWritingStats } from '../lib/writingStats';
import { todayKey } from '../lib/writingPrefs';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'WritingGoals'>;

// Where the writing habit is kept: today's words against the target, the streak, the target
// itself, and the reminder. Everything here is read from useWritingStats, which counts prose
// from either editor -- this screen owns no numbers of its own.

const DAYS_SHOWN = 14;

function dayKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

export default function WritingGoalsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const stats = useWritingStats();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [targetInput, setTargetInput] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Goals' });
  }, [navigation]);

  useEffect(() => {
    void stats.setProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    setTargetInput(stats.target > 0 ? String(stats.target) : '');
  }, [stats.target]);

  const progress = stats.target > 0 ? Math.min(1, stats.todayWords / stats.target) : 0;
  const todayMet = stats.target > 0 && stats.todayWords >= stats.target;

  function commitTarget() {
    const n = parseInt(targetInput.replace(/[^\d]/g, ''), 10);
    void stats.setTarget(Number.isFinite(n) && n > 0 ? n : 0);
  }

  async function toggleReminder(on: boolean) {
    if (on) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for StoryMap in your phone settings to get a reminder.');
        return;
      }
      if (stats.target <= 0) {
        Alert.alert('Set a target first', 'The reminder only fires on a day the target is not met, so it needs one.');
        return;
      }
    }
    void stats.setReminder({ ...stats.reminder, enabled: on });
  }

  function shiftReminder(minutes: number) {
    const total = (stats.reminder.hour * 60 + stats.reminder.minute + minutes + 24 * 60) % (24 * 60);
    void stats.setReminder({ ...stats.reminder, hour: Math.floor(total / 60), minute: total % 60 });
  }

  const today = todayKey();
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => dayKeyOffset(DAYS_SHOWN - 1 - i));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Today */}
      <View style={styles.card}>
        <Text style={styles.label}>Today</Text>
        <Text style={styles.big}>
          {stats.todayWords.toLocaleString()}
          {stats.target > 0 && <Text style={styles.bigDim}> / {stats.target.toLocaleString()}</Text>}
        </Text>
        <Text style={styles.sub}>{stats.target > 0 ? (todayMet ? 'Target met.' : 'words of finished prose') : 'No target set'}</Text>
        {stats.target > 0 && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </View>

      {/* Streak */}
      <View style={styles.row}>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>Streak</Text>
          <Text style={styles.big}>{stats.streak}</Text>
          <Text style={styles.sub}>{stats.streak === 1 ? 'day' : 'days'} in a row</Text>
        </View>
        <View style={[styles.card, styles.half]}>
          <Text style={styles.label}>Best</Text>
          <Text style={styles.big}>{stats.best}</Text>
          <Text style={styles.sub}>{stats.best === 1 ? 'day' : 'days'}</Text>
        </View>
      </View>

      {/* Last fortnight */}
      <View style={styles.card}>
        <Text style={styles.label}>Last {DAYS_SHOWN} days</Text>
        <View style={styles.dots}>
          {days.map((k) => {
            const r = stats.history[k];
            const hit = !!r && r.target > 0 && r.words >= r.target;
            const some = !!r && r.words > 0;
            return (
              <View
                key={k}
                style={[
                  styles.dot,
                  some && styles.dotSome,
                  hit && styles.dotHit,
                  k === today && styles.dotToday,
                ]}
              />
            );
          })}
        </View>
        <Text style={styles.hint}>Gold: target met. Faint: wrote, short of it. Outlined: today.</Text>
      </View>

      {/* Target */}
      <View style={styles.card}>
        <Text style={styles.label}>Daily target</Text>
        <Text style={styles.hint}>
          Finished prose only -- words across every chapter, from the first open each day. Pages never count;
          they're for ideas. Written in either editor, it counts.
        </Text>
        <View style={styles.targetRow}>
          <TextInput
            style={styles.input}
            value={targetInput}
            onChangeText={setTargetInput}
            keyboardType="number-pad"
            placeholder="e.g. 1000"
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={commitTarget}
            onBlur={commitTarget}
          />
          <Pressable onPress={commitTarget} style={styles.primary}>
            <Text style={styles.primaryText}>Set</Text>
          </Pressable>
        </View>
      </View>

      {/* Reminder */}
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Reminder</Text>
            <Text style={styles.hint}>A notification at this time on any day the target isn't met yet.</Text>
          </View>
          <Switch
            value={stats.reminder.enabled}
            onValueChange={toggleReminder}
            trackColor={{ false: colors.borderDim, true: withOpacity(colors.gold, 0.5) }}
            thumbColor={stats.reminder.enabled ? colors.gold : colors.textFaint}
          />
        </View>
        <View style={styles.timeRow}>
          <Pressable onPress={() => shiftReminder(-30)} hitSlop={8} style={styles.step}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.time}>{formatTime(stats.reminder.hour, stats.reminder.minute)}</Text>
          <Pressable onPress={() => shiftReminder(30)} hitSlop={8} style={styles.step}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    card: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
    },
    label: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2 },
    big: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 30, marginTop: 6 },
    bigDim: { color: colors.textFaint, fontSize: 18 },
    sub: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 13, marginTop: 2 },
    hint: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    track: { height: 3, backgroundColor: colors.borderDim, marginTop: 12, borderRadius: 2 },
    fill: { height: 3, backgroundColor: colors.gold, borderRadius: 2 },
    dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.borderDim },
    dotSome: { backgroundColor: withOpacity(colors.gold, 0.35) },
    dotHit: { backgroundColor: colors.gold },
    dotToday: { borderWidth: 2, borderColor: colors.text },
    targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    input: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      color: colors.text,
      fontFamily: FONTS.headingBold,
      fontSize: 20,
      paddingVertical: 6,
    },
    primary: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.gold },
    primaryText: { color: colors.bg, fontFamily: FONTS.headingBold, fontSize: 13, letterSpacing: 1 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 14 },
    time: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 20, minWidth: 110, textAlign: 'center' },
    step: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepText: { color: colors.gold, fontSize: 20, lineHeight: 22 },
  });
}
