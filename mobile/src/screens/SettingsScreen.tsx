import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import * as Brightness from 'expo-brightness';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import Icon from '../components/Icon';
import type { SignedInStackParamList } from '../navigation/types';
import { FONTS, type ThemeColors, type ThemeMode, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Settings'>;

// A distinct orange-yellow, shared by the brightness slider and the day/night toggle per
// explicit feedback -- not the app's usual gold, which stays reserved for the rest of
// the UI.
const BRIGHTNESS_COLOR = '#f2a13c';
const TOGGLE_HEIGHT = 60;
const TOGGLE_PAD = 5;
const KNOB_SIZE = TOGGLE_HEIGHT - TOGGLE_PAD * 2;

// App-wide preferences that don't belong to any one screen -- day/night (moved here from
// the hamburger drawer per feedback: a toggle buried in a per-project menu didn't read as
// an account-wide setting) and device screen brightness (app-scoped via
// Brightness.setBrightnessAsync, not the system-wide setting -- that needs a heavier
// Android permission and would affect apps outside StoryMap, which isn't the ask here).
export default function SettingsScreen({ navigation }: Props) {
  const { preference, mode, colors, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [brightness, setBrightness] = useState<number | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Settings' });
  }, [navigation]);

  useEffect(() => {
    Brightness.getBrightnessAsync().then(setBrightness);
  }, []);

  async function onBrightnessChange(value: number) {
    setBrightness(value);
    await Brightness.setBrightnessAsync(value);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <DayNightToggle
        mode={mode}
        onChange={(next) => setPreference(next)}
        styles={styles}
        trackColor={colors.border}
      />

      <Pressable
        style={[styles.autoRow, preference === 'auto' && styles.autoRowActive]}
        onPress={() => setPreference(preference === 'auto' ? mode : 'auto')}
      >
        <Icon name="sun-moon-auto" size={18} color={preference === 'auto' ? BRIGHTNESS_COLOR : colors.textFaint} />
        <Text style={[styles.autoLabel, preference === 'auto' && styles.autoLabelActive]}>Follow time of day</Text>
      </Pressable>
      <Text style={styles.hint}>"Follow time of day" uses this device's own clock -- day 6am-6pm, night otherwise.</Text>

      <Text style={styles.sectionLabel}>Screen brightness</Text>
      {brightness !== null && (
        <View style={styles.brightnessRow}>
          <Icon name="sun" size={13} color={BRIGHTNESS_COLOR} />
          <Slider
            style={[styles.brightnessSlider, { flex: 1 }]}
            minimumValue={0}
            maximumValue={1}
            value={brightness}
            minimumTrackTintColor={BRIGHTNESS_COLOR}
            maximumTrackTintColor={colors.border}
            thumbTintColor={BRIGHTNESS_COLOR}
            onValueChange={onBrightnessChange}
          />
          <Icon name="sun" size={24} color={BRIGHTNESS_COLOR} />
        </View>
      )}
      <Text style={styles.hint}>Only affects this app's screen while it's open.</Text>
    </ScrollView>
  );
}

// Day/night as a single two-ended toggle: sun at the left end, moon at the right end,
// swipe right for night and left for day (a tap flips it too). Painted in the same
// orange-yellow as the brightness slider, per explicit request. "Auto" is no longer one
// of three swipe positions -- it's a separate opt-in below, so this control always reads
// as exactly two states.
function DayNightToggle({
  mode,
  onChange,
  styles,
  trackColor,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  styles: ReturnType<typeof makeStyles>;
  trackColor: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(0, trackWidth - KNOB_SIZE - TOGGLE_PAD * 2);
  const target = mode === 'night' ? 1 : 0;
  const progress = useSharedValue(target);
  // Live drag position: -1 means "not dragging, follow `progress`".
  const drag = useSharedValue(-1);

  useEffect(() => {
    progress.value = withTiming(target, { duration: 200 });
  }, [target, progress]);

  const position = useDerivedValue(() => (drag.value >= 0 ? drag.value : progress.value));

  const pan = Gesture.Pan()
    .onBegin(() => {
      drag.value = progress.value;
    })
    .onUpdate((e) => {
      if (travel <= 0) return;
      drag.value = Math.min(1, Math.max(0, (mode === 'night' ? 1 : 0) + e.translationX / travel));
    })
    .onEnd(() => {
      const next = drag.value > 0.5 ? 'night' : 'day';
      drag.value = -1;
      runOnJS(onChange)(next);
    })
    .onFinalize(() => {
      drag.value = -1;
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onChange)(mode === 'night' ? 'day' : 'night');
  });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * travel }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: 1 - position.value }));

  return (
    <View style={styles.toggleRow}>
      <Icon name="sun" size={26} color={mode === 'day' ? BRIGHTNESS_COLOR : trackColor} />
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View style={styles.toggleTrack} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.toggleFill, fillStyle]} />
          <Animated.View style={[styles.toggleKnob, knobStyle]} />
        </View>
      </GestureDetector>
      <Icon name="moon" size={26} color={mode === 'night' ? BRIGHTNESS_COLOR : trackColor} />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 20, paddingBottom: 60 },
    sectionLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 24,
      marginBottom: 10,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    toggleTrack: {
      flex: 1,
      height: TOGGLE_HEIGHT,
      borderRadius: TOGGLE_HEIGHT / 2,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: BRIGHTNESS_COLOR,
      padding: TOGGLE_PAD,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    // Fades out as the knob travels toward night, so the track itself reads warm in day
    // and dark in night rather than being a static rail.
    toggleFill: { backgroundColor: withOpacity(BRIGHTNESS_COLOR, 0.28) },
    toggleKnob: {
      width: KNOB_SIZE,
      height: KNOB_SIZE,
      borderRadius: KNOB_SIZE / 2,
      backgroundColor: BRIGHTNESS_COLOR,
    },
    autoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      alignSelf: 'flex-start',
      marginTop: 16,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    autoRowActive: { borderColor: BRIGHTNESS_COLOR, backgroundColor: withOpacity(BRIGHTNESS_COLOR, 0.12) },
    autoLabel: { color: colors.textDim, fontFamily: FONTS.bodyMedium, fontSize: 13 },
    autoLabelActive: { color: colors.text },
    hint: { color: colors.textFaint, fontSize: 11.5, marginTop: 8 },
    brightnessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // The library gives no track-thickness prop -- scaling the whole control vertically
    // is the practical way to make the track/thumb read as visibly thicker.
    brightnessSlider: { transform: [{ scaleY: 1.8 }] },
  });
}
