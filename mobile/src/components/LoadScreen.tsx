import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Image as SvgImage, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

import { FONTS } from '../theme';

// THE LOAD SCREEN (2026-11-09). Beige paper, the gold compass rose in the middle -- the same
// rose as the app icon and the drawer, re-toned to gold by scripts/build-app-icon.py -- and,
// beneath it, the writer's projects as frames on a spinning wheel: a zoetrope drum, the wheel of
// frames that is spun to make pictures move. Each frame faces outward from the drum, so it turns
// edge-on at the sides and shows its back as it passes behind.
//
// It covers the app while the fonts load and the session is restored (with a short minimum, so
// it is seen rather than flashed), then the wheel slows and stops with the last project opened at
// the front, and the screen fades. Tapping a frame stops the wheel on it and opens that project.
//
// Always beige, day or night: it is the app's cover, not one of its pages.

const ROSE = require('../../assets/load-rose.png');
const ROSE_MASK = require('../../assets/load-rose-mask.png');
const ROSE_RATIO = 383 / 363;

const PAPER = '#f2e3bf';
const PAPER_EDGE = '#dfc792';
const GOLD = '#b8862e';
const GOLD_DEEP = '#8a6420';
const FILM = '#2f2116';

const FW = 104; // a frame, at the front of the wheel
const FH = 80;
const SPIN_PERIOD = 7000; // ms per turn once the wheel is up to speed
const SPEED = (2 * Math.PI) / (SPIN_PERIOD / 1000); // rad/s

export type WheelProject = { id: string; name: string };

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function LoadScreen({
  ready,
  fontsLoaded,
  projects,
  frontId,
  onPick,
  onFinished,
}: {
  /** Everything the app needs is loaded: the wheel may stop and the screen may go. */
  ready: boolean;
  fontsLoaded: boolean;
  projects: WheelProject[];
  /** The project to stop on, if there is one (the last opened). */
  frontId: string | null;
  /** A frame was tapped: open that project once the screen has gone. */
  onPick: (p: WheelProject) => void;
  onFinished: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const logo = Math.min(width * 0.5, 230);

  // The wheel: never fewer than ten frames, so a writer with two projects still sees a drum.
  // Frames past the projects are blank film.
  const slots = Math.max(10, Math.min(16, projects.length));
  const step = (2 * Math.PI) / slots;
  const R = Math.min(width * 0.4, 200);
  const TILT = 16;

  const rot = useSharedValue(0);
  const fade = useSharedValue(1);
  const intro = useSharedValue(0);
  const breath = useSharedValue(0);
  const halo = useSharedValue(0);
  const bezel = useSharedValue(0);
  const shine = useSharedValue(0);
  const lit = useSharedValue(0);
  const stopping = useRef(false);
  const settled = useRef(false);
  const fading = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const picked = useRef<WheelProject | null>(null);

  useEffect(() => {
    // Spun up by hand: a fast first turn that slows into a steady one.
    rot.value = withSequence(
      withTiming(Math.PI * 1.6, { duration: 1500, easing: Easing.out(Easing.quad) }),
      withRepeat(withTiming(Math.PI * 1.6 + 2 * Math.PI, { duration: SPIN_PERIOD, easing: Easing.linear }), -1, false),
    );
    intro.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    halo.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    bezel.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false);
    shine.value = withDelay(500, withRepeat(withSequence(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
      withDelay(1600, withTiming(0, { duration: 0 })),
    ), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Turn the wheel until slot `k` is at the front, slowing as it gets there, then go. */
  function stopOn(k: number, quick: boolean) {
    if (stopping.current) return;
    stopping.current = true;
    const current = rot.value;
    cancelAnimation(rot);
    const base = -k * step;
    const lead = quick ? 0.15 : 0.35;
    const target = base + 2 * Math.PI * Math.ceil((current + lead - base) / (2 * Math.PI));
    const dist = target - current;
    // An ease-out lands at the wheel's own speed when it can; a long way round is a final flick.
    const duration = Math.min(quick ? 900 : 2000, Math.max(700, (3 * dist) / SPEED * 1000));
    rot.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(onSettled)(quick);
    });
  }
  // The screen goes once the wheel has stopped AND the app is ready, whichever is last.
  function onSettled(quick: boolean) {
    settled.current = true;
    lit.value = withTiming(1, { duration: 260 });
    if (readyRef.current) fadeOut(quick ? 150 : 380);
  }
  function fadeOut(delay: number) {
    if (fading.current) return;
    fading.current = true;
    fade.value = withDelay(delay, withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }, (gone) => {
      if (gone) runOnJS(finish)();
    }));
  }
  function finish() {
    if (picked.current) onPick(picked.current);
    onFinished();
  }

  // Ready: stop on the last project, or on whichever frame is nearest the front.
  useEffect(() => {
    if (!ready) return;
    if (settled.current) return fadeOut(150); // a frame was tapped first and the wheel waits
    if (stopping.current) return;
    const k = frontId ? projects.findIndex((p) => p.id === frontId) : -1;
    if (k >= 0) return stopOn(k, false);
    const nearest = Math.round(((-rot.value % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / step) % slots;
    stopOn(nearest, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function pick(k: number) {
    const p = projects[k];
    if (!p || stopping.current) return;
    // Only a frame facing the viewer can be meant.
    if (Math.cos(rot.value + k * step) < 0.25) return;
    picked.current = p;
    stopOn(k, true);
  }

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: (1 - intro.value) * 14 }, { scale: 0.94 + 0.06 * intro.value + 0.025 * breath.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: (0.35 + 0.35 * halo.value) * intro.value,
    transform: [{ scale: 0.92 + 0.12 * halo.value }],
  }));
  const bezelStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * intro.value,
    transform: [{ rotate: `${bezel.value * 360}deg` }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: (1 - intro.value) * 8 }],
  }));
  const shineProps = useAnimatedProps(() => ({ x: -logo * 0.9 + shine.value * logo * 2 }));

  const logoTop = height * 0.36 - logo / 2;
  const wheelTop = logoTop + logo + 92;
  const frames = useMemo(() => Array.from({ length: slots }, (_, i) => i), [slots]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <StatusBar style="dark" />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="paper" cx="50%" cy="38%" rx="75%" ry="70%">
            <Stop offset="0" stopColor="#f8edd1" />
            <Stop offset="0.6" stopColor={PAPER} />
            <Stop offset="1" stopColor={PAPER_EDGE} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#paper)" />
      </Svg>

      <Motes width={width} top={logoTop} span={logo} />

      {/* The rose: a warm glow behind it, a slowly turning bezel of ticks, the rose breathing,
          and a band of light that sweeps across the gold every few seconds. */}
      <Animated.View style={[styles.abs, { left: width / 2 - logo * 0.75, top: logoTop + logo / 2 - logo * 0.75, width: logo * 1.5, height: logo * 1.5 }, haloStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#f7d98a" stopOpacity="0.85" />
              <Stop offset="0.55" stopColor="#e8c46a" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#e8c46a" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.abs, { left: width / 2 - logo * 0.62, top: logoTop + logo / 2 - logo * 0.62, width: logo * 1.24, height: logo * 1.24 }, bezelStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="48" fill="none" stroke={GOLD} strokeWidth="0.5" strokeDasharray="0.6 2.4" />
          <Circle cx="50" cy="50" r="45.5" fill="none" stroke={GOLD} strokeWidth="0.3" opacity="0.6" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.abs, { left: width / 2 - logo / 2, top: logoTop, width: logo, height: logo }, logoStyle]}>
        <Image source={ROSE} style={{ width: logo, height: logo / ROSE_RATIO, marginTop: (logo - logo / ROSE_RATIO) / 2 }} />
        <Svg width={logo} height={logo} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fff6d8" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#fff6d8" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
            </LinearGradient>
            <Mask id="roseMask" maskUnits="userSpaceOnUse" x="0" y="0" width={logo} height={logo}>
              <SvgImage href={ROSE_MASK} x={0} y={(logo - logo / ROSE_RATIO) / 2} width={logo} height={logo / ROSE_RATIO} />
            </Mask>
          </Defs>
          <AnimatedRect animatedProps={shineProps} y={0} width={logo * 0.45} height={logo} fill="url(#shine)" mask="url(#roseMask)" transform={`skewX(-18)`} />
        </Svg>
      </Animated.View>

      {fontsLoaded && (
        <Animated.View style={[styles.abs, { left: 0, right: 0, top: logoTop + logo + 14, alignItems: 'center' }, wordStyle]}>
          <Text style={styles.word}>STORYMAP</Text>
          <Text style={styles.tagline}>Chart the past. Shape the future.</Text>
        </Animated.View>
      )}

      {/* The drum: a faint track, then the frames, each placed by its angle on the wheel. */}
      <Svg width={width} height={FH + TILT * 2 + 40} style={[styles.abs, { left: 0, top: wheelTop - TILT - 20 }]}>
        <Ellipse cx={width / 2} cy={FH / 2 + TILT + 20 + FH / 2 + 4} rx={R + FW * 0.35} ry={TILT + 6} fill="rgba(120,80,20,0.10)" />
        <Ellipse cx={width / 2} cy={FH / 2 + TILT + 20} rx={R} ry={TILT} fill="none" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1" />
      </Svg>
      <View style={[styles.abs, { left: width / 2 - FW / 2, top: wheelTop, width: FW, height: FH }]} pointerEvents="box-none">
        {frames.map((i) => (
          <Frame
            key={i}
            index={i}
            step={step}
            R={R}
            tilt={TILT}
            rot={rot}
            lit={lit}
            project={projects[i] ?? null}
            fontsLoaded={fontsLoaded}
            onPress={() => pick(i)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function Frame({ index, step, R, tilt, rot, lit, project, fontsLoaded, onPress }: {
  index: number;
  step: number;
  R: number;
  tilt: number;
  rot: SharedValue<number>;
  lit: SharedValue<number>;
  project: WheelProject | null;
  fontsLoaded: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const a = rot.value + index * step;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const depth = (c + 1) / 2;
    return {
      zIndex: Math.round(depth * 100),
      opacity: 0.3 + 0.7 * depth,
      transform: [
        { translateX: R * s },
        { translateY: tilt * c },
        { scale: 0.7 + 0.3 * depth },
        // Facing outward from the drum: edge-on at the sides.
        { scaleX: Math.max(0.05, Math.abs(c)) },
      ],
    };
  });
  // The picture shows from the front only; from behind, a frame is the back of the film.
  const faceStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, Math.cos(rot.value + index * step) * 3)) }));
  const backStyle = useAnimatedStyle(() => ({ opacity: Math.min(0.9, Math.max(0, -Math.cos(rot.value + index * step) * 3)) }));
  const glowStyle = useAnimatedStyle(() => {
    const c = Math.cos(rot.value + index * step);
    return { opacity: lit.value * Math.max(0, (c - 0.9) * 10) };
  });
  const sprockets = [0, 1, 2, 3, 4, 5];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Pressable style={styles.film} onPress={onPress} disabled={!project}>
        <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
        <View style={styles.holes}>{sprockets.map((h) => <View key={h} style={styles.hole} />)}</View>
        <View style={[styles.window, !project && styles.windowBlank]}>
          <Animated.View style={[styles.face, faceStyle]}>
            {project && fontsLoaded && (
              <>
                <Text style={styles.frameNo}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.frameName} numberOfLines={3}>{project.name}</Text>
              </>
            )}
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.back, backStyle]} />
        </View>
        <View style={styles.holes}>{sprockets.map((h) => <View key={h} style={styles.hole} />)}</View>
      </Pressable>
    </Animated.View>
  );
}

/** A few specks of gold dust rising past the rose and fading. */
function Motes({ width, top, span }: { width: number; top: number; span: number }) {
  const specks = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({
      x: width / 2 + (((i * 37) % 100) / 100 - 0.5) * span * 1.5,
      size: 2 + ((i * 7) % 3),
      delay: (i * 530) % 3200,
      drift: ((i % 2 ? 1 : -1) * (6 + (i % 4) * 3)),
    })),
    [width, span],
  );
  return (
    <>
      {specks.map((m, i) => <Mote key={i} {...m} top={top + span} rise={span * 1.1} />)}
    </>
  );
}
function Mote({ x, size, delay, drift, top, rise }: { x: number; size: number; delay: number; drift: number; top: number; rise: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.value * Math.PI) * 0.7,
    transform: [{ translateY: -t.value * rise }, { translateX: Math.sin(t.value * Math.PI * 2) * drift }],
  }));
  return <Animated.View style={[styles.mote, { left: x, top, width: size, height: size, borderRadius: size / 2 }, style]} />;
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, elevation: 1000, backgroundColor: PAPER },
  abs: { position: 'absolute' },
  word: { fontFamily: FONTS.display, fontSize: 22, letterSpacing: 7, color: GOLD_DEEP, marginLeft: 7 },
  tagline: { fontFamily: FONTS.literaryItalic, fontSize: 13, color: '#8a7355', marginTop: 4 },
  film: { flex: 1, backgroundColor: FILM, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 3, justifyContent: 'space-between' },
  glow: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderRadius: 6, borderWidth: 2, borderColor: '#e8c46a' },
  holes: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  hole: { width: 7, height: 5, borderRadius: 1.5, backgroundColor: 'rgba(242,227,191,0.75)' },
  window: { flex: 1, marginVertical: 3, backgroundColor: '#f4e6c3', borderRadius: 1, overflow: 'hidden' },
  windowBlank: { backgroundColor: '#e8d6ac' },
  face: { flex: 1, paddingHorizontal: 6, paddingVertical: 3, justifyContent: 'center' },
  back: { backgroundColor: '#4a3524' },
  frameNo: { position: 'absolute', top: 2, right: 4, fontFamily: FONTS.mono, fontSize: 8, color: '#9a8466' },
  frameName: { fontFamily: FONTS.heading, fontSize: 11, lineHeight: 13, color: '#3a2415', textAlign: 'center' },
  mote: { position: 'absolute', backgroundColor: '#d9ad4c' },
});
