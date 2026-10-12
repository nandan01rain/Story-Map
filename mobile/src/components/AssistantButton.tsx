import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { useAssistantStore } from '../store/assistantStore';
import { FONTS, useTheme, withOpacity } from '../theme';
import Icon from './Icon';

// The assistant, reachable from every stage of the writing pipeline (2026-10-12).
//
// Two pieces. The TOGGLE sits top right on the project's own page and is the one on/off for
// the assistant: the same `assistant_enabled` account flag Settings has always carried, so
// it follows the writer between devices. The BUTTON -- a star -- appears on Pages, Scenes,
// Storyboard and Prose only while the toggle is on, and opens the assistant with whatever
// chapter is in front of the writer as context. Off, nothing about the assistant shows
// anywhere but the toggle itself: it must never be required for writing.

type Nav = NativeStackNavigationProp<SignedInStackParamList>;

function useHydrated() {
  const hydrated = useAssistantStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) void useAssistantStore.getState().hydrate();
  }, [hydrated]);
}

/** A star that opens the assistant, shown only while the assistant is on. */
export function AssistantButton({ projectId, chapterId, size = 20 }: { projectId: string; chapterId?: string; size?: number }) {
  useHydrated();
  const enabled = useAssistantStore((s) => s.enabled);
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  if (!enabled) return null;
  return (
    <Pressable
      onPress={() => navigation.navigate('Assistant', { projectId, chapterId })}
      hitSlop={10}
      accessibilityLabel="Ask the assistant"
      style={styles.star}
    >
      <Icon name="sparkle" size={size} color={colors.gold} />
    </Pressable>
  );
}

/** The on/off, with the star beside it to open the assistant while it is on. */
export function AssistantToggle({ projectId }: { projectId: string }) {
  useHydrated();
  const enabled = useAssistantStore((s) => s.enabled);
  const setEnabled = useAssistantStore((s) => s.setEnabled);
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => (enabled ? navigation.navigate('Assistant', { projectId }) : void setEnabled(true))}
        hitSlop={8}
        accessibilityLabel={enabled ? 'Ask the assistant' : 'Turn the assistant on'}
        style={styles.label}
      >
        <Icon name="sparkle" size={17} color={enabled ? colors.gold : withOpacity(colors.textFaint, 0.7)} />
        <Text style={[styles.text, { color: enabled ? colors.gold : colors.textFaint }]}>Assistant</Text>
      </Pressable>
      <Switch
        value={enabled}
        onValueChange={(v) => void setEnabled(v)}
        trackColor={{ false: withOpacity(colors.textFaint, 0.35), true: withOpacity(colors.gold, 0.55) }}
        thumbColor={enabled ? colors.gold : colors.textFaint}
        style={styles.switch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  star: { paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  text: { fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 1.2 },
  switch: { transform: [{ scale: 0.85 }] },
});
