import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType, documentType } from '../store/documentStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

// The document type picker, one row of chips. Shared by the document editor and the Drive
// import screen, which each had their own -- and both had the §36.3 fault: a horizontal
// ScrollView in a column with no `flexGrow: 0` stretched every chip to fill the screen, which
// is how a tap anywhere below the title could silently retype a document.
export default function DocumentTypeChips({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (type: DocumentType) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const current = documentType(value);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {DOCUMENT_TYPES.map((type) => (
        <Pressable key={type} style={[styles.chip, current === type && styles.chipOn]} onPress={() => onChange(type)}>
          <Text style={[styles.text, current === type && styles.textOn]}>{DOCUMENT_TYPE_LABELS[type]}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flexGrow: 0, flexShrink: 0 },
    row: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
    chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.14) },
    text: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 12.5 },
    textOn: { color: colors.text },
  });
}
