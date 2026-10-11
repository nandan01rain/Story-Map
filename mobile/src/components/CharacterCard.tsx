import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { type StoryCast, useStoryboardStore } from '../store/storyboardStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';
import { Flourish } from './DrawerOrnaments';

// A character's picture, from the private bucket through a signed link. With no picture, the
// initial on the character's own colour -- a card from day one, not a hole.
export function CharacterPicture({
  member,
  size,
  height,
  radius,
}: {
  member: StoryCast;
  size: number;
  height?: number;
  radius?: number;
}) {
  const imageUrl = useStoryboardStore((s) => s.imageUrl);
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUri(null);
    void imageUrl(member.image_path).then((u) => alive && setUri(u));
    return () => {
      alive = false;
    };
  }, [member.image_path, imageUrl]);

  const h = height ?? size;
  const r = radius ?? size * 0.08;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: h, borderRadius: r }} resizeMode="cover" />;
  return (
    <View style={[styles.initialBox, { width: size, height: h, borderRadius: r, backgroundColor: member.color }]}>
      <Text style={[styles.initial, { fontSize: Math.min(size, h) * 0.42 }]}>{(member.name || '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const GOLD = '#c9a24a';
const GOLD_DIM = '#8a6d2e';
const CARD_BLACK = '#15110b';

/**
 * The flashcard: a collectible-card frame -- black ground, a gold double rule with a star in
 * each corner, the picture inset, the name in decorative capitals and the short description
 * under it. Only the three things the writer asked for: picture, name, a few words.
 */
export default function CharacterCard({
  member,
  bibleTitle,
  onOpenBible,
  onOpenCharacter,
}: {
  member: StoryCast;
  bibleTitle: string | null;
  onOpenBible?: () => void;
  onOpenCharacter?: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { width: winW, height: winH } = useWindowDimensions();
  const cardW = Math.min(winW - 64, 320, (winH - 200) / 1.62);
  const cardH = cardW * 1.62;
  const pictureW = cardW - 44;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[s.card, { width: cardW, height: cardH }]}>
        <View style={s.innerFrame}>
          <View style={s.topRule}>
            <View style={s.ruleLine} />
            <Flourish size={14} color={GOLD} />
            <View style={s.ruleLine} />
          </View>

          <View style={[s.pictureFrame, { borderColor: member.color }]}>
            <CharacterPicture member={member} size={pictureW} height={cardH * 0.56} radius={4} />
          </View>

          <Text style={s.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {(member.name || 'Unnamed').toUpperCase()}
          </Text>
          <View style={s.midRule} />
          <Text style={[s.desc, !member.description && s.descEmpty]} numberOfLines={4}>
            {member.description || 'A few words about them, added on their page'}
          </Text>
        </View>
        {/* A star at each corner, over the double rule. */}
        <View style={[s.corner, { top: 4, left: 4 }]}><Flourish size={12} color={GOLD} /></View>
        <View style={[s.corner, { top: 4, right: 4 }]}><Flourish size={12} color={GOLD} /></View>
        <View style={[s.corner, { bottom: 4, left: 4 }]}><Flourish size={12} color={GOLD} /></View>
        <View style={[s.corner, { bottom: 4, right: 4 }]}><Flourish size={12} color={GOLD} /></View>
      </View>

      <View style={s.actions}>
        {onOpenCharacter ? (
          <Pressable onPress={onOpenCharacter} hitSlop={8}>
            <Text style={s.action}>Their page</Text>
          </Pressable>
        ) : null}
        {bibleTitle && onOpenBible ? (
          <Pressable onPress={onOpenBible} hitSlop={8}>
            <Text style={s.action}>Character bible</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#2a2119', fontFamily: FONTS.handBold, paddingRight: 4 },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: CARD_BLACK,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: GOLD,
      padding: 6,
      shadowColor: '#000',
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 14,
    },
    innerFrame: {
      flex: 1,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: GOLD_DIM,
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 12,
    },
    topRule: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', marginBottom: 8 },
    ruleLine: { flex: 1, height: 1, backgroundColor: GOLD_DIM },
    pictureFrame: { borderWidth: 2, borderRadius: 6, padding: 2, backgroundColor: '#000' },
    name: {
      color: GOLD,
      fontFamily: 'CinzelDecorative_700Bold',
      fontSize: 24,
      letterSpacing: 1.5,
      textAlign: 'center',
      marginTop: 12,
      paddingHorizontal: 4,
    },
    midRule: { width: '46%', height: 1, backgroundColor: GOLD_DIM, marginVertical: 7 },
    desc: {
      color: '#e8d9b0',
      fontFamily: FONTS.heading,
      fontSize: 11.5,
      lineHeight: 16,
      letterSpacing: 1.2,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    descEmpty: { color: '#8f8068' },
    corner: { position: 'absolute' },
    actions: { flexDirection: 'row', gap: 28, marginTop: 16 },
    action: { color: colors.gold, fontFamily: FONTS.hand, fontSize: 21, paddingRight: 4 },
  });
}
