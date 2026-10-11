import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';

import type { Block, Inline } from '../lib/markdown';
import { FONTS, type ThemeColors, withOpacity } from '../theme';

// One parsed markdown block, drawn the way a chat window renders markdown: headings at their
// own sizes, real bold and italics, bullets and numbers hanging in a gutter, tables as tables,
// quotes behind a rule. Prose follows the reader's font, size, spacing and alignment; headings
// take the app's Cinzel, as chapter titles do.
//
// Memoised and keyed per block, because the document reader is a virtualised list of these
// and a 700 KB document is several thousand of them.

export type MarkdownLook = {
  colors: ThemeColors;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  align: TextStyle['textAlign'];
};

const HEADING_SCALE = [1.55, 1.32, 1.14, 1.02, 0.95, 0.9];

// Real faces rather than synthesised ones. Android does not reliably embolden or slant a
// custom font from fontWeight/fontStyle alone, so bold and italic name the bundled files: a
// semibold and an italic for Spectral, a medium for JetBrains Mono. Bold italic has no file of
// its own and takes the italic face, which still reads as emphasis.
function emphasisFace(family: string, bold?: boolean, italic?: boolean): TextStyle {
  const mono = family.startsWith('JetBrainsMono');
  if (italic) return mono ? { fontStyle: 'italic' } : { fontFamily: 'Spectral_400Regular_Italic' };
  if (bold) return { fontFamily: mono ? 'JetBrainsMono_500Medium' : 'Spectral_600SemiBold' };
  return {};
}

function Spans({ inline, look, base }: { inline: Inline[]; look: MarkdownLook; base?: TextStyle }) {
  const family = (base?.fontFamily as string | undefined) ?? look.fontFamily;
  return (
    <>
      {inline.map((s, i) => {
        // Headings are already set in their own display face; emphasis inside one keeps it.
        const style: TextStyle = base?.fontFamily ? {} : emphasisFace(family, s.bold, s.italic);
        if (s.strike) style.textDecorationLine = 'line-through';
        if (s.code) {
          style.fontFamily = FONTS.mono;
          style.fontSize = (base?.fontSize ?? look.fontSize) * 0.86;
          style.backgroundColor = withOpacity(look.colors.gold, 0.12);
          style.color = look.colors.text;
        }
        return (
          <Text key={i} style={style}>
            {s.text}
          </Text>
        );
      })}
    </>
  );
}

function MarkdownBlockInner({ block, look }: { block: Block; look: MarkdownLook }) {
  const { colors, fontFamily, fontSize, lineHeight, align } = look;
  const prose: TextStyle = { color: colors.text, fontFamily, fontSize, lineHeight, textAlign: align };

  switch (block.kind) {
    case 'heading': {
      const scale = HEADING_SCALE[block.level - 1] ?? 1;
      const size = fontSize * scale;
      return (
        <View style={[styles.headingWrap, block.level <= 2 && { marginTop: lineHeight * 1.1 }]}>
          <Text
            selectable
            style={{
              color: block.level <= 2 ? colors.gold : colors.text,
              fontFamily: block.level <= 2 ? FONTS.headingBold : FONTS.bodySemiBold,
              fontSize: size,
              lineHeight: size * 1.3,
              letterSpacing: block.level <= 2 ? 0.4 : 0,
            }}
          >
            <Spans inline={block.inline} look={look} base={{ fontSize: size, fontFamily: block.level <= 2 ? FONTS.headingBold : FONTS.bodySemiBold }} />
          </Text>
          {block.level === 1 && <View style={[styles.headingRule, { backgroundColor: withOpacity(colors.gold, 0.4) }]} />}
        </View>
      );
    }
    case 'paragraph':
      return (
        <Text selectable style={[prose, { marginBottom: lineHeight * 0.6 }]}>
          <Spans inline={block.inline} look={look} />
        </Text>
      );
    case 'item':
      return (
        <View style={[styles.item, { paddingLeft: block.depth * fontSize * 1.3, marginBottom: lineHeight * 0.25 }]}>
          <Text style={[prose, styles.marker, { width: fontSize * (block.marker === '•' ? 1.2 : 1.9), textAlign: 'left', color: colors.gold }]}>
            {block.marker}
          </Text>
          <Text selectable style={[prose, { flex: 1, textAlign: align === 'justify' ? 'left' : align }]}>
            <Spans inline={block.inline} look={look} />
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: withOpacity(colors.gold, 0.6), marginBottom: lineHeight * 0.6 }]}>
          <Text selectable style={[prose, { color: colors.textDim, fontStyle: 'italic' }]}>
            <Spans inline={block.inline} look={look} />
          </Text>
        </View>
      );
    case 'code':
      return (
        <ScrollView horizontal style={[styles.code, { backgroundColor: withOpacity(colors.gold, 0.08) }]}>
          <Text selectable style={{ color: colors.text, fontFamily: FONTS.mono, fontSize: fontSize * 0.82, lineHeight: fontSize * 1.3 }}>
            {block.text}
          </Text>
        </ScrollView>
      );
    case 'rule':
      return <View style={[styles.rule, { backgroundColor: colors.borderDim, marginVertical: lineHeight * 0.6 }]} />;
    case 'table': {
      const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length));
      const cell: TextStyle = { color: colors.text, fontFamily, fontSize: fontSize * 0.88, lineHeight: fontSize * 1.3 };
      const width = Math.max(110, Math.min(240, fontSize * 10));
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginBottom: lineHeight * 0.7 }}>
          <View style={[styles.table, { borderColor: colors.border }]}>
            {[block.header, ...block.rows].map((row, r) => (
              <View
                key={r}
                style={[
                  styles.tableRow,
                  { borderColor: colors.borderDim },
                  r === 0 && { backgroundColor: withOpacity(colors.gold, 0.1) },
                ]}
              >
                {Array.from({ length: cols }, (_, c) => (
                  <View key={c} style={[styles.tableCell, { width, borderColor: colors.borderDim }]}>
                    <Text selectable style={[cell, r === 0 && { fontFamily: 'Spectral_600SemiBold' }, { textAlign: block.align[c] ?? 'left' }]}>
                      <Spans inline={row[c] ?? []} look={look} base={{ fontSize: fontSize * 0.88 }} />
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }
  }
}

export const MarkdownBlock = memo(MarkdownBlockInner);

const styles = StyleSheet.create({
  headingWrap: { marginBottom: 10 },
  headingRule: { height: 1, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  marker: {},
  quote: { borderLeftWidth: 3, paddingLeft: 12 },
  code: { borderRadius: 6, padding: 10, marginBottom: 12 },
  rule: { height: 1 },
  table: { borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tableCell: { paddingHorizontal: 10, paddingVertical: 7, borderRightWidth: StyleSheet.hairlineWidth },
});
