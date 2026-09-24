import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { bookName } from '../lib/storyData';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

// One row of book chips, the open one in gold. The Writer, the prose report and the
// storyboard each used to draw their own copy of this, with slightly different sizes.
//
// A horizontal ScrollView has no height of its own inside a column: it takes flex space and
// its children stretch to fill it (§36.3). `flexGrow: 0` keeps it to its content;
// `alignItems` keeps a chip a chip.
export default function BookChips({
  books,
  selected,
  onSelect,
  style,
}: {
  books: number[];
  selected: number | null;
  onSelect: (book: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.scroll, style]} contentContainerStyle={styles.row}>
      {books.map((b) => (
        <Pressable key={b} onPress={() => onSelect(b)} style={[styles.chip, b === selected && styles.chipOn]}>
          <Text style={[styles.text, b === selected && styles.textOn]}>{bookName(b)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flexGrow: 0, flexShrink: 1 },
    row: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.borderDim },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.1) },
    text: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 1 },
    textOn: { color: colors.gold },
  });
}
