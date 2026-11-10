import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Image as SvgImage, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';


// THE LOAD SCREEN (2026-11-09). Beige paper and the gold compass rose in the middle -- the same
// rose as the app icon and the drawer, re-toned to gold by scripts/build-app-icon.py -- with a
// breathing glow, a slowly turning bezel, a band of light sweeping the gold and specks of gold dust.
// Nothing else: the projects' wheel is on the Projects page (components/ProjectWheel.tsx).
//
// It covers the app while the fonts load and the session is restored, for at least a moment so it
// is seen rather than flashed, then fades. Always beige, day or night: it is the app's cover.

const ROSE = require('../../assets/load-rose.png');
const ROSE_MASK = require('../../assets/load-rose-mask.png');
const ROSE_RATIO = 383 / 363;

const PAPER = '#f2e3bf';
const PAPER_EDGE = '#dfc792';
const GOLD = '#b8862e';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function LoadScreen({ ready, onFinished }: {
  /** Everything the app needs is loaded: the cover may go. */
  ready: boolean;
  onFinished: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const logo = Math.min(width * 0.5, 230);

  const fade = useSharedValue(1);
  const intro = useSharedValue(0);
  const breath = useSharedValue(0);
  const halo = useSharedValue(0);
  const bezel = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
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

  useEffect(() => {
    if (!ready) return;
    fade.value = withTiming(0, { duration: 450, easing: Easing.in(Easing.quad) }, (gone) => {
      if (gone) runOnJS(onFinished)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
  const shineProps = useAnimatedProps(() => ({ x: -logo * 0.9 + shine.value * logo * 2 }));

  const logoTop = height / 2 - logo / 2;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <StatusBar style="dark" />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="paper" cx="50%" cy="50%" rx="75%" ry="70%">
            <Stop offset="0" stopColor="#f8edd1" />
            <Stop offset="0.6" stopColor={PAPER} />
            <Stop offset="1" stopColor={PAPER_EDGE} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#paper)" />
      </Svg>

      <Motes width={width} top={logoTop} span={logo} />

      {/* The rose: a cream glow behind it, a slowly turning bezel of ticks, the rose breathing,
          and a band of light that sweeps across the gold every few seconds. */}
      <Animated.View style={[styles.abs, { left: width / 2 - logo * 0.75, top: logoTop + logo / 2 - logo * 0.75, width: logo * 1.5, height: logo * 1.5 }, haloStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#fff9e4" stopOpacity="0.95" />
              <Stop offset="0.45" stopColor="#fff0c8" stopOpacity="0.45" />
              <Stop offset="0.72" stopColor="#fff0c8" stopOpacity="0" />
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
          <AnimatedRect animatedProps={shineProps} y={0} width={logo * 0.45} height={logo} fill="url(#shine)" mask="url(#roseMask)" transform="skewX(-18)" />
        </Svg>
      </Animated.View>
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
  mote: { position: 'absolute', backgroundColor: '#d9ad4c' },
});
