import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const DURATION = 200;
// Fraction of the panel's width the finger must cross (or the flick velocity it must
// beat) for a release to settle open rather than snapping back.
const SETTLE_FRACTION = 0.3;
const SETTLE_VELOCITY = 500;

export type SlidePanelController = ReturnType<typeof useSlidePanel>;

// Drives a slide-in-from-the-left panel (the nav drawer, the Reader's table of contents)
// directly from the finger rather than as a fixed open/close animation.
//
// Replaces an earlier Modal + Animated.timing version that only ever ran a canned
// animation on an `onEnd` decision: a swipe that the recognizer scored slightly
// differently produced nothing at all, and mounting a Modal at the same moment an
// animation started made the panel that DID open visibly unstable. Here the panel is a
// plain in-tree overlay (no Modal) whose progress is a shared value the gesture writes
// every frame, so the panel follows the finger, an incomplete swipe settles back
// smoothly instead of sticking, and opening is never all-or-nothing.
export function useSlidePanel(panelWidth: number) {
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(false);

  const open = useCallback(() => {
    setMounted(true);
    progress.value = withTiming(1, { duration: DURATION });
  }, [progress]);

  const close = useCallback(() => {
    progress.value = withTiming(0, { duration: DURATION }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [progress]);

  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [mounted, close]);

  function settle(shouldOpen: boolean) {
    'worklet';
    progress.value = withTiming(shouldOpen ? 1 : 0, { duration: DURATION }, (finished) => {
      if (finished && !shouldOpen) runOnJS(setMounted)(false);
    });
  }

  // Attach to a narrow strip along the screen's left edge. The panel is mounted on
  // activation (not on touch-down) so an ordinary tap in that strip never puts a
  // full-screen overlay in front of the content.
  const openGesture = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-24, 24])
    .onStart(() => {
      runOnJS(setMounted)(true);
      progress.value = 0;
    })
    .onUpdate((e) => {
      progress.value = Math.min(1, Math.max(0, e.translationX / panelWidth));
    })
    .onEnd((e) => {
      settle(e.translationX > panelWidth * SETTLE_FRACTION || e.velocityX > SETTLE_VELOCITY);
    });

  // Attach to the open panel itself. failOffsetY lets a mostly-vertical drag scroll the
  // panel's own content instead of dragging the panel.
  const closeGesture = Gesture.Pan()
    .activeOffsetX(-12)
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      progress.value = Math.min(1, Math.max(0, 1 + e.translationX / panelWidth));
    })
    .onEnd((e) => {
      settle(!(e.translationX < -panelWidth * SETTLE_FRACTION || e.velocityX < -SETTLE_VELOCITY));
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -panelWidth * (1 - progress.value) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return { mounted, open, close, openGesture, closeGesture, panelStyle, scrimStyle };
}
