import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import type { SlidePanelController } from '../lib/useSlidePanel';
import { useTheme } from '../theme';

// Width of the invisible left-edge strip that opens a panel. Wide enough that a swipe
// aimed at "the edge of the screen" actually lands on it -- the previous 24px strip was
// a large part of why the drawer so often failed to open at all.
export const EDGE_SWIPE_WIDTH = 36;

export function EdgeSwipeZone({ controller }: { controller: SlidePanelController }) {
  return (
    <GestureDetector gesture={controller.openGesture}>
      <View style={styles.edgeZone} />
    </GestureDetector>
  );
}

// Render as the LAST child of a screen so it stacks above that screen's content. Renders
// nothing at all while closed, so it costs nothing and blocks no touches when not in use.
export default function SlidePanel({
  controller,
  width,
  children,
}: {
  controller: SlidePanelController;
  width: number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  if (!controller.mounted) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, controller.scrimStyle]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={controller.close} />
      <GestureDetector gesture={controller.closeGesture}>
        <Animated.View
          style={[
            styles.panel,
            { width, backgroundColor: colors.rail, borderRightColor: colors.gold },
            controller.panelStyle,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  edgeZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: EDGE_SWIPE_WIDTH, zIndex: 5 },
  // Must out-stack the edge strip, or the strip's open-gesture would sit on top of the
  // open panel and swallow the drag that closes it again.
  overlay: { zIndex: 10 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRightWidth: 1 },
});
