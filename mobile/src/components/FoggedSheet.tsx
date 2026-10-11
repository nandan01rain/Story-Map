import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme, withOpacity } from '../theme';

// A card over fogged glass: the screen behind stays, washed out and soft, the way breath fogs a
// pane (2026-10-11). Not a true blur -- that needs a native module the installed binary does not
// carry -- but a translucent wash of the page's own colour with a lighter haze over it, which
// reads as frosted rather than as a dark modal curtain. A plain overlay, not a native Modal, so a
// list remounting underneath cannot strand it (§36.3). Tap the fog to close.
export default function FoggedSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { colors, mode } = useTheme();
  return (
    <View style={styles.fill}>
      <Pressable
        style={[styles.fill, { backgroundColor: withOpacity(colors.bg, mode === 'night' ? 0.78 : 0.72) }]}
        onPress={onClose}
      >
        <View style={[styles.fill, { backgroundColor: mode === 'night' ? 'rgba(160,175,210,0.10)' : 'rgba(255,255,255,0.28)' }]} />
      </Pressable>
      <View style={styles.center} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 22 },
});
