import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';

import { FONTS } from '../theme';

// THE PROJECT WHEEL (2026-11-09). The writer's projects as frames on a zoetrope drum -- the wheel
// of frames spun to make pictures move. Each frame faces outward from the drum, so it turns
// edge-on at the sides and shows the back of the film as it passes behind.
//
// Swipe to turn it (it carries on a little and settles on a project); tap the front frame to open
// it, or a side frame to bring it round. It opens with a turn of the wheel that comes to rest on
// the last project opened. Frames past the projects are blank film, so a writer with two projects
// still has a drum; the wheel never settles on a blank one.

const FW = 104;
const FH = 80;
const TILT = 16;

export type WheelProject = { id: string; name: string };

export default function ProjectWheel({
  projects,
  frontId,
  onFront,
  onOpen,
}: {
  projects: WheelProject[];
  /**
   * The project at the front. The wheel opens with a turn that comes to rest on it, and after that
   * turns to it whenever it changes or moves -- a project reordered stays in front.
   */
  frontId: string | null;
  /** The project now at the front, whenever the wheel settles. */
  onFront: (p: WheelProject) => void;
  onOpen: (p: WheelProject) => void;
}) {
  const { width } = useWindowDimensions();
  const slots = Math.max(10, projects.length);
  const step = (2 * Math.PI) / slots;
  const R = Math.min(width * 0.4, 200);
  const n = projects.length;

  const rot = useSharedValue(0);
  const start = useSharedValue(0);
  const settledOnce = useRef(false);
  const introDone = useRef(false);
  const frontIndex = projects.findIndex((p) => p.id === frontId);

  // The project slot nearest the front for a given rotation -- never a blank one.
  function nearestProject(r: number): number {
    if (!n) return -1;
    let best = 0, bestCos = -2;
    for (let k = 0; k < n; k++) {
      const c = Math.cos(r + k * step);
      if (c > bestCos) { bestCos = c; best = k; }
    }
    return best;
  }
  /** The rotation that puts slot k at the front, the shortest way round from r. */
  function rotFor(k: number, r: number): number {
    const base = -k * step;
    return base + 2 * Math.PI * Math.round((r - base) / (2 * Math.PI));
  }
  function settleOn(k: number, from: number, duration = 650) {
    if (k < 0) return;
    rot.value = withTiming(rotFor(k, from), { duration, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(report)(k);
    });
  }
  function report(k: number) {
    introDone.current = true;
    const p = projects[k];
    if (p) onFront(p);
  }

  // On first showing: a turn of the wheel that comes to rest on the last project opened.
  useEffect(() => {
    if (!n || settledOnce.current) return;
    settledOnce.current = true;
    const k = Math.max(0, projects.findIndex((p) => p.id === frontId));
    const target = rotFor(k, 0) + 2 * Math.PI;
    rot.value = withTiming(target, { duration: 1600, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(report)(k);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
  // Afterwards: turn to the front project when it changes or moves, and if it is gone (deleted),
  // settle on whichever is nearest.
  useEffect(() => {
    if (!introDone.current || !n) return;
    if (frontIndex < 0) return settleOn(nearestProject(rot.value), rot.value, 400);
    if (Math.cos(rot.value + frontIndex * step) < 0.9999) settleOn(frontIndex, rot.value, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontIndex, n]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      cancelAnimation(rot);
      start.value = rot.value;
    })
    .onUpdate((e) => {
      rot.value = start.value + e.translationX / R;
    })
    .onEnd((e) => {
      // Carries on a little with the swipe, then settles.
      runOnJS(fling)(rot.value + (e.velocityX / R) * 0.25);
    });
  function fling(r: number) {
    settleOn(nearestProject(r), r, 700);
  }

  function tap(k: number) {
    if (!projects[k]) return;
    if (Math.cos(rot.value + k * step) > 0.97) onOpen(projects[k]);
    else {
      cancelAnimation(rot);
      settleOn(k, rot.value, 550);
    }
  }

  const frames = useMemo(() => Array.from({ length: slots }, (_, i) => i), [slots]);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.stage, { height: FH + TILT * 2 + 60 }]}>
        <Svg width={width} height={FH + TILT * 2 + 60} style={StyleSheet.absoluteFill}>
          <Ellipse cx={width / 2} cy={30 + TILT + FH + 4} rx={R + FW * 0.35} ry={TILT + 6} fill="rgba(120,80,20,0.10)" />
          <Ellipse cx={width / 2} cy={30 + TILT + FH / 2} rx={R} ry={TILT} fill="none" stroke="#b8862e" strokeOpacity="0.35" strokeWidth="1" />
        </Svg>
        <View style={[styles.hub, { left: width / 2 - FW / 2, top: 30 + TILT }]} pointerEvents="box-none">
          {frames.map((i) => (
            <Frame key={i} index={i} step={step} R={R} rot={rot} project={projects[i] ?? null} onPress={() => tap(i)} />
          ))}
        </View>
      </View>
    </GestureDetector>
  );
}

function Frame({ index, step, R, rot, project, onPress }: {
  index: number;
  step: number;
  R: number;
  rot: SharedValue<number>;
  project: WheelProject | null;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const a = rot.value + index * step;
    const c = Math.cos(a);
    const depth = (c + 1) / 2;
    return {
      zIndex: Math.round(depth * 100),
      opacity: 0.3 + 0.7 * depth,
      transform: [
        { translateX: R * Math.sin(a) },
        { translateY: TILT * c },
        { scale: 0.7 + 0.3 * depth },
        // Facing outward from the drum: edge-on at the sides.
        { scaleX: Math.max(0.05, Math.abs(c)) },
      ],
    };
  });
  // The picture shows from the front only; from behind, a frame is the back of the film.
  const faceStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, Math.cos(rot.value + index * step) * 3)) }));
  const backStyle = useAnimatedStyle(() => ({ opacity: Math.min(0.9, Math.max(0, -Math.cos(rot.value + index * step) * 3)) }));
  // The frame at the front is lit.
  const glowStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, (Math.cos(rot.value + index * step) - 0.97) * 33) }));
  const holes = [0, 1, 2, 3, 4, 5];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Pressable style={styles.film} onPress={onPress} disabled={!project}>
        {project && <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />}
        <View style={styles.holes}>{holes.map((h) => <View key={h} style={styles.hole} />)}</View>
        <View style={[styles.window, !project && styles.windowBlank]}>
          <Animated.View style={[styles.face, faceStyle]}>
            {project && (
              <>
                <Text style={styles.frameNo}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.frameName} numberOfLines={3}>{project.name}</Text>
              </>
            )}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.back, backStyle]} />
        </View>
        <View style={styles.holes}>{holes.map((h) => <View key={h} style={styles.hole} />)}</View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%' },
  hub: { position: 'absolute', width: FW, height: FH },
  film: { flex: 1, backgroundColor: '#2f2116', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 3, justifyContent: 'space-between' },
  glow: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderRadius: 6, borderWidth: 2, borderColor: '#e8c46a' },
  holes: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  hole: { width: 7, height: 5, borderRadius: 1.5, backgroundColor: 'rgba(242,227,191,0.75)' },
  window: { flex: 1, marginVertical: 3, backgroundColor: '#f4e6c3', borderRadius: 1, overflow: 'hidden' },
  windowBlank: { backgroundColor: '#e8d6ac' },
  face: { flex: 1, paddingHorizontal: 6, paddingVertical: 3, justifyContent: 'center' },
  back: { backgroundColor: '#4a3524' },
  frameNo: { position: 'absolute', top: 2, right: 4, fontFamily: FONTS.mono, fontSize: 8, color: '#9a8466' },
  frameName: { fontFamily: FONTS.heading, fontSize: 11, lineHeight: 13, color: '#3a2415', textAlign: 'center' },
});
