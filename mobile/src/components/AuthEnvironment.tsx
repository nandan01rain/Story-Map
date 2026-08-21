import { useEffect, useMemo } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

import type { TimeOfDay } from '../lib/timeOfDay';

// The living sign-in scene, ported from the PWA's #auth-env-stage (index.html). One flat
// painted background plus additive overlay layers -- never a replacement for the artwork.
//
// Geometry: the artwork is 853x1844 and is cover-fitted, so a "stage" box is sized to
// exactly that cover fit and centered; every overlay then positions itself in percentages
// of the STAGE, i.e. of the painting's own coordinates, not the viewport's. Without that
// the lanterns and ships would drift off their painted targets on any screen whose aspect
// ratio differs from the art's.
//
// The moving layers (ships, birds, lights, lanterns, sky grade) are all pixel-cropped
// from the sunset painting specifically and have no day/night counterparts, so -- exactly
// as in the PWA -- day and night render the flat background alone.
//
// No mixBlendMode anywhere, deliberately. The CSS version blends the lanterns and lights
// with `screen` and the two ripple sets with `overlay`/`soft-light`, and RN 0.86 does
// accept those values -- but on device every layer carrying one rendered as nothing,
// twice over, across two completely different implementations of the layers themselves.
// The layers that always worked (ships, birds, lights before a blend mode was put on
// them) are the ones that never had one. So the blending is dropped and the layers are
// tuned as plain alpha compositing instead: warm light on dark art reads close enough to
// `screen`, and the ripple bands are pale and translucent enough that `overlay` was never
// doing much beyond what their own alpha does.
const ART_WIDTH = 853;
const ART_HEIGHT = 1844;

const BACKGROUNDS: Record<TimeOfDay, ImageSourcePropType> = {
  day: require('../../assets/env/bg-day.webp'),
  sunset: require('../../assets/env/bg-sunset.webp'),
  night: require('../../assets/env/bg-night.webp'),
};

const SKY_GRADE = require('../../assets/env/sky-grade.webp');
const COMPASS = require('../../assets/env/compass.webp');
const WORDMARK_DARK = require('../../assets/env/wordmark-dark.webp');
const WORDMARK_GOLD = require('../../assets/env/wordmark-gold.webp');

// left/top/width/height as percentages of the artwork, measured off it in the PWA.
const SHIPS = [
  { src: require('../../assets/env/ship-a.png'), left: 70.0, top: 48.7, width: 14.8, height: 9.1, bobY: 1.5, bobDeg: 0.31, duration: 4300, delay: 0 },
  { src: require('../../assets/env/ship-b.png'), left: 63.2, top: 55.3, width: 13.6, height: 8.4, bobY: 1.4, bobDeg: 0.34, duration: 5600, delay: 1700 },
  { src: require('../../assets/env/ship-c.png'), left: 35.8, top: 49.4, width: 8.4, height: 5.4, bobY: 1.8, bobDeg: 0.4, duration: 3700, delay: 900 },
];

// Each bird has a matching "cover" patch that sits under it, painting out the bird baked
// into the original artwork so the animated one can travel without leaving a twin behind.
const BIRDS = [
  {
    cover: require('../../assets/env/birdcover-1.png'),
    src: require('../../assets/env/bird-1.png'),
    left: 69.4,
    top: 13.4,
    width: 12.1,
    height: 6.6,
    from: { x: 6, y: 4, deg: 1.1 },
    to: { x: -124, y: -16, deg: -1.6 },
    duration: 21000,
    delay: 0,
  },
  {
    cover: require('../../assets/env/birdcover-2.png'),
    src: require('../../assets/env/bird-2.png'),
    left: 61.2,
    top: 31.5,
    width: 9.6,
    height: 4.3,
    from: { x: -4, y: 2, deg: -0.9 },
    to: { x: 108, y: -13, deg: 1.4 },
    duration: 29000,
    delay: 0,
  },
];

// The ~470 warm specks of the painted city, split into three out-of-phase groups so the
// hillside flickers rather than breathing as one. In the PWA these are CSS mask images
// over a warm fill; React Native has no mask-image, but the masks are white-on-transparent
// so tinting them warm and animating opacity produces the same result directly.
const LIGHT_LAYERS = [
  { src: require('../../assets/env/lights-1.png'), duration: 5300, delay: 0 },
  { src: require('../../assets/env/lights-2.png'), duration: 7100, delay: 2600 },
  { src: require('../../assets/env/lights-3.png'), duration: 9700, delay: 5100 },
];
const LIGHT_TINT = 'rgba(255,196,112,0.95)';
// Uneven stops so it reads as flickering lamplight rather than a smooth sine fade. The
// swing is deliberately wide -- what makes a twinkle read is the contrast between dim and
// bright, not the peak.
const TWINKLE_STOPS = [0.08, 0.95, 0.24, 0.82, 0.14, 0.66, 0.08];

const LANTERNS = [
  { left: 7.2, top: 76.5, delay: 0 },
  { left: 92.0, top: 73.8, delay: 1900 },
];
// A little wider than the CSS's 11% so the glow reads as a pool of light rather than a
// dot, but not so wide it stops looking like it comes from the painted lantern.
const LANTERN_SIZE_PCT = 12.5;
// A candle, not a strobe. The first attempt at "irregular" swung 0.22-1.0 in steps as
// short as 70ms, which reads as a fault in the light rather than a flame. A real candle
// sits at a fairly steady low glow and wanders around it: the band is narrow (0.34-0.58),
// most steps are long, and only occasionally does a short one nudge it -- that rare quick
// step is what keeps it from looking mechanical, so it has to be the exception, not the
// rule. Scale barely moves for the same reason.
const LANTERN_FLICKER: { opacity: number; scale: number; duration: number }[] = [
  { opacity: 0.46, scale: 1.0, duration: 900 },
  { opacity: 0.54, scale: 1.02, duration: 640 },
  { opacity: 0.4, scale: 0.99, duration: 1150 },
  { opacity: 0.5, scale: 1.01, duration: 380 },
  { opacity: 0.58, scale: 1.03, duration: 820 },
  { opacity: 0.44, scale: 1.0, duration: 260 },
  { opacity: 0.52, scale: 1.015, duration: 1030 },
  { opacity: 0.34, scale: 0.98, duration: 700 },
  { opacity: 0.48, scale: 1.005, duration: 470 },
  { opacity: 0.42, scale: 0.995, duration: 1240 },
];

// Water. The only layer that actually reads as movement: a broad gradient sliding over the
// bay is imperceptible (no edge for the eye to track), fine bands are not. Two band sets at
// non-multiple periods beat against each other so it looks organic rather than like
// scanlines, and each one travels exactly one of its own periods per cycle, so the loop is
// seamless.
//
// Both are shaped by env-water-mask.png -- a luminance threshold over the bay, blurred --
// rather than a geometric approximation, because an ellipse can't follow the shoreline and
// visibly bleeds the bands onto the city hillside.
const WATER_MASK = require('../../assets/env/water-mask.png');
// The bay's vertical extent in the artwork, read off the mask's own alpha channel (opaque
// through the middle band, clear above and below). Only used to size the band layer -- the
// actual shape still comes from the mask.
const WATER_TOP_PCT = 40;
const WATER_BOTTOM_PCT = 70;
const RIPPLES = [
  // Peaks are lifted from the CSS's 0.30/0.34 to compensate for losing overlay/soft-light,
  // which brightened them against the lit water.
  { id: 'a', color: '#fffcee', peak: 0.42, peakAt: 3, period: 9, duration: 2600, tilt: -1 },
  { id: 'b', color: '#fff6de', peak: 0.46, peakAt: 4, period: 14, duration: 3900, tilt: 1 },
];

function useAlternatingLoop(duration: number, delay: number) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [duration, delay, progress]);
  return progress;
}

function assetAspect(src: ImageSourcePropType): number {
  const resolved = Image.resolveAssetSource(src);
  return resolved && resolved.width ? resolved.height / resolved.width : 1;
}

function Ship({ ship, stageW, stageH }: { ship: (typeof SHIPS)[number]; stageW: number; stageH: number }) {
  const progress = useAlternatingLoop(ship.duration, ship.delay);
  const height = (ship.height / 100) * stageH;
  const style = useAnimatedStyle(() => {
    const t = progress.value * 2 - 1; // -1 .. 1
    return {
      transform: [
        { translateY: t * (ship.bobY / 100) * height },
        { rotate: `${t * ship.bobDeg}deg` },
      ],
    };
  });
  return (
    <Animated.Image
      source={ship.src}
      resizeMode="stretch"
      style={[
        {
          position: 'absolute',
          left: (ship.left / 100) * stageW,
          top: (ship.top / 100) * stageH,
          width: (ship.width / 100) * stageW,
          height,
        },
        style,
      ]}
    />
  );
}

function Bird({ bird, stageW, stageH }: { bird: (typeof BIRDS)[number]; stageW: number; stageH: number }) {
  const progress = useAlternatingLoop(bird.duration, bird.delay);
  const width = (bird.width / 100) * stageW;
  const height = (bird.height / 100) * stageH;
  const layout = {
    position: 'absolute' as const,
    left: (bird.left / 100) * stageW,
    top: (bird.top / 100) * stageH,
    width,
    height,
  };
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: ((bird.from.x + (bird.to.x - bird.from.x) * p) / 100) * width },
        { translateY: ((bird.from.y + (bird.to.y - bird.from.y) * p) / 100) * height },
        { rotate: `${bird.from.deg + (bird.to.deg - bird.from.deg) * p}deg` },
      ],
    };
  });
  return (
    <>
      <Image source={bird.cover} resizeMode="stretch" style={layout} />
      <Animated.Image source={bird.src} resizeMode="stretch" style={[layout, style]} />
    </>
  );
}

function CityLights({ layer, stageW, stageH }: { layer: (typeof LIGHT_LAYERS)[number]; stageW: number; stageH: number }) {
  const opacity = useSharedValue(TWINKLE_STOPS[0]);
  useEffect(() => {
    const step = layer.duration / (TWINKLE_STOPS.length - 1);
    opacity.value = withDelay(
      layer.delay,
      withRepeat(
        withSequence(
          ...TWINKLE_STOPS.slice(1).map((stop) => withTiming(stop, { duration: step, easing: Easing.inOut(Easing.ease) })),
        ),
        -1,
        false,
      ),
    );
  }, [layer.duration, layer.delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: stageW, height: stageH }} pointerEvents="none">
      <Animated.Image
        source={layer.src}
        resizeMode="stretch"
        tintColor={LIGHT_TINT}
        style={[{ width: stageW, height: stageH }, style]}
      />
    </View>
  );
}

// Built only from things this app already proves work on device: SVG shapes (the whole
// icon set is react-native-svg), a plain Reanimated transform, and MaskedView for the
// shoreline. The motion is a transform on the wrapping View rather than an animated SVG
// attribute, and the mask sits OUTSIDE that view so the water shape stays put while the
// bands drift through it.
function RippleLayer({ ripple, stageW, stageH }: { ripple: (typeof RIPPLES)[number]; stageW: number; stageH: number }) {
  const shift = useSharedValue(0);
  useEffect(() => {
    shift.value = withRepeat(
      withTiming(ripple.period, { duration: ripple.duration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [ripple.period, ripple.duration, shift]);

  // The band field overhangs the bay top and bottom so travelling one period never drags a
  // bare edge into the water.
  const overhangY = 0.03 * stageH;
  const bandsTop = (WATER_TOP_PCT / 100) * stageH - overhangY;
  const bandsH = ((WATER_BOTTOM_PCT - WATER_TOP_PCT) / 100) * stageH + overhangY * 2;

  // The repeat is written out as stops -- one transparent/peak/transparent triplet per
  // period down a single gradient. CSS would say repeating-linear-gradient; SVG's <Pattern>
  // never painted on this device and react-native-svg has no spreadMethod, but plain
  // gradient stops are exactly what the lanterns already paint.
  const gradientId = `band-grad-${ripple.id}`;
  const maskId = `water-${ripple.id}`;
  const stops = useMemo(() => {
    const out: { offset: number; opacity: number }[] = [];
    const periods = Math.ceil(bandsH / ripple.period);
    for (let i = 0; i <= periods; i += 1) {
      const base = (i * ripple.period) / bandsH;
      if (base > 1) break;
      out.push({ offset: base, opacity: 0 });
      out.push({ offset: Math.min(1, base + ripple.peakAt / bandsH), opacity: ripple.peak });
      out.push({ offset: Math.min(1, base + ripple.period / bandsH), opacity: 0 });
    }
    return out;
  }, [bandsH, ripple.period, ripple.peakAt, ripple.peak]);

  const animatedProps = useAnimatedProps(() => ({ y: bandsTop + shift.value }));

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: stageW, height: stageH }} pointerEvents="none">
      {/* Masked inside the SVG rather than with MaskedView. MaskedView was the last piece
          here never shown to work on this device (Expo's own docs call its Android support
          experimental), and it was the remaining suspect once the bands themselves were
          rebuilt from proven primitives. react-native-svg draws the whole app's icon set,
          so keeping the mask, the bands and the animation all inside one <Svg> leaves
          nothing unproven -- and if animating the rect's y turns out not to drive, the
          bands are at least VISIBLE and static rather than absent, which distinguishes the
          two failures immediately. */}
      <Svg width={stageW} height={stageH}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {stops.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={ripple.color} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
          {/* alpha, not luminance: the mask PNG is white throughout and carries the bay
              shape purely in its alpha channel, which is also how CSS mask-image reads it. */}
          <Mask id={maskId} maskType="alpha">
            <SvgImage
              href={WATER_MASK}
              x={0}
              y={0}
              width={stageW}
              height={stageH}
              preserveAspectRatio="none"
            />
          </Mask>
        </Defs>
        <G mask={`url(#${maskId})`}>
          <AnimatedRect
            animatedProps={animatedProps}
            x={0}
            width={stageW}
            height={bandsH}
            fill={`url(#${gradientId})`}
          />
        </G>
      </Svg>
    </View>
  );
}

function Lantern({ lantern, index, stageW, stageH }: { lantern: (typeof LANTERNS)[number]; index: number; stageW: number; stageH: number }) {
  const size = (LANTERN_SIZE_PCT / 100) * stageW;
  const gradientId = `lantern-${index}`;
  // Second lantern burns slower, so the two never line up.
  const rate = index === 0 ? 1 : 1.31;

  const flicker = useSharedValue(0.6);
  const scale = useSharedValue(1);
  useEffect(() => {
    const opacitySteps = LANTERN_FLICKER.map((step) =>
      withTiming(step.opacity, { duration: step.duration * rate, easing: Easing.linear }),
    );
    const scaleSteps = LANTERN_FLICKER.map((step) =>
      withTiming(step.scale, { duration: step.duration * rate, easing: Easing.linear }),
    );
    flicker.value = withDelay(lantern.delay, withRepeat(withSequence(...opacitySteps), -1, false));
    scale.value = withDelay(lantern.delay, withRepeat(withSequence(...scaleSteps), -1, false));
  }, [flicker, scale, lantern.delay, rate]);

  const style = useAnimatedStyle(() => ({
    opacity: flicker.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: (lantern.left / 100) * stageW - size / 2,
          top: (lantern.top / 100) * stageH - size / 2,
          width: size,
          height: size,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#ffdb9b" stopOpacity={0.9} />
            <Stop offset="30%" stopColor="#ffbf70" stopOpacity={0.62} />
            <Stop offset="60%" stopColor="#ffa851" stopOpacity={0.28} />
            <Stop offset="100%" stopColor="#f0912f" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

export default function AuthEnvironment({ mode, onReady }: { mode: TimeOfDay; onReady?: () => void }) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Reproduce object-fit:cover as a real box, so percentage offsets map to the artwork.
  const stageW = Math.max(screenW, screenH * (ART_WIDTH / ART_HEIGHT));
  const stageH = stageW * (ART_HEIGHT / ART_WIDTH);

  const animated = mode === 'sunset';
  const wordmark = mode === 'night' ? WORDMARK_GOLD : WORDMARK_DARK;
  // The dark wordmark reads fine against day and sunset's brighter sky but vanishes into
  // night's near-black one, where gold matches the lantern light already in the scene.

  const compassWidth = (17.5 / 100) * stageW;
  const wordmarkWidth = (53.4 / 100) * stageW;
  const compassAspect = useMemo(() => assetAspect(COMPASS), []);
  const wordmarkAspect = useMemo(() => assetAspect(wordmark), [wordmark]);

  const reveal = useSharedValue(0);
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
  function handleLoaded() {
    reveal.value = withTiming(1, { duration: 450 });
    onReady?.();
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Same warm placeholder gradient the PWA paints behind the art, so the wait for a
          300KB image is a dusk-toned screen rather than a blank one. */}
      <View style={styles.placeholder} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: (screenW - stageW) / 2,
            top: (screenH - stageH) / 2,
            width: stageW,
            height: stageH,
            overflow: 'hidden',
          },
          revealStyle,
        ]}
      >
        <Image
          source={BACKGROUNDS[mode]}
          resizeMode="cover"
          style={{ width: stageW, height: stageH }}
          onLoad={handleLoaded}
          onError={handleLoaded}
        />

        {animated && (
          <>
            {/* Cools the very warm painted sky back toward the violet in its upper
                corners, which is what gives the twinkling lights something to read
                against. Always on within sunset -- it is the intended look, not an
                effect. */}
            <Image
              source={SKY_GRADE}
              resizeMode="stretch"
              style={{ position: 'absolute', left: 0, top: 0, width: stageW, height: stageH / 2 }}
            />
            {BIRDS.map((bird, i) => (
              <Bird key={`bird-${i}`} bird={bird} stageW={stageW} stageH={stageH} />
            ))}
            {RIPPLES.map((ripple) => (
              <RippleLayer key={`ripple-${ripple.id}`} ripple={ripple} stageW={stageW} stageH={stageH} />
            ))}
            {LIGHT_LAYERS.map((layer, i) => (
              <CityLights key={`lights-${i}`} layer={layer} stageW={stageW} stageH={stageH} />
            ))}
            {SHIPS.map((ship, i) => (
              <Ship key={`ship-${i}`} ship={ship} stageW={stageW} stageH={stageH} />
            ))}
            {LANTERNS.map((lantern, i) => (
              <Lantern key={`lantern-${i}`} lantern={lantern} index={i} stageW={stageW} stageH={stageH} />
            ))}
          </>
        )}

        <Image
          source={COMPASS}
          resizeMode="contain"
          style={{
            position: 'absolute',
            top: (17.4 / 100) * stageH,
            left: (stageW - compassWidth) / 2,
            width: compassWidth,
            height: compassWidth * compassAspect,
          }}
        />
        <Image
          source={wordmark}
          resizeMode="contain"
          style={{
            position: 'absolute',
            top: (27.0 / 100) * stageH,
            left: (stageW - wordmarkWidth) / 2,
            width: wordmarkWidth,
            height: wordmarkWidth * wordmarkAspect,
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...StyleSheet.absoluteFill, backgroundColor: '#8a5a3a' },
});
