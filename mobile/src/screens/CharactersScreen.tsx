import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CharacterPicture } from '../components/CharacterCard';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { documentType, useDocumentStore } from '../store/documentStore';
import { useStoryboardStore } from '../store/storyboardStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Characters'>;

// The project's characters (2026-10-11): the people the storyboard colours its notes by, each
// with a picture, a few lines and the character bible they are written up in. Same rows as the
// storyboard's cast -- adding someone here adds them there, and the reverse.
//
// "Gather from character bibles" turns each "04 · Character — Name" document (or any document
// typed Character Bible) into a character linked to it, matching existing characters by name
// rather than duplicating them. Run it again whenever a bible is added.
const BIBLE_TITLE = /^\s*\d*\s*·?\s*Character\s+—\s+(.+?)\s*$/i;

export default function CharactersScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const board = useStoryboardStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Characters' });
    const unsub = navigation.addListener('focus', () => void board.fetch(projectId));
    void board.fetch(projectId);
    void fetchDocuments(projectId);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, projectId]);

  const bibles = useMemo(
    () =>
      documents
        .filter((d) => documentType(d.type) !== 'Archive')
        .map((d) => ({ d, m: BIBLE_TITLE.exec(d.title) }))
        .filter(({ d, m }) => (m && !/supporting/i.test(m[1])) || (documentType(d.type) === 'Character Bible' && !/supporting|older drafts/i.test(d.title)))
        .map(({ d, m }) => ({ id: d.id, title: d.title, name: (m ? m[1] : d.title).trim() })),
    [documents],
  );
  const bibleTitle = (id: string | null | undefined) => documents.find((d) => d.id === id)?.title ?? null;

  async function gather() {
    if (!user) return;
    if (!board.charactersSupported) {
      Alert.alert('One step first', 'Paste supabase/migrations/20261011c_characters.sql into the Supabase SQL editor once, then gather.');
      return;
    }
    setBusy(true);
    let added = 0;
    let linked = 0;
    for (const b of bibles) {
      const existing = useStoryboardStore.getState().cast.find((c) => c.name.trim().toLowerCase() === b.name.toLowerCase());
      if (existing) {
        if (!existing.document_id) {
          await board.updateCast(existing.id, { document_id: b.id });
          linked += 1;
        }
        continue;
      }
      const { member } = await board.addCast({ projectId, userId: user.id, name: b.name });
      if (member) {
        await board.updateCast(member.id, { document_id: b.id });
        added += 1;
      }
    }
    setBusy(false);
    Alert.alert('Gathered', added + linked === 0 ? 'Every character bible already has its character.' : `${added} added, ${linked} linked to their bible.`);
  }

  async function addOne() {
    if (!user) return;
    const { member, error } = await board.addCast({ projectId, userId: user.id, name: 'New character' });
    if (error || !member) {
      Alert.alert('Not added', error ?? 'Unknown error');
      return;
    }
    navigation.navigate('Character', { projectId, characterId: member.id });
  }

  if (!board.wallSupported) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.note}>
          Characters need supabase/migrations/20261011b_storyboard_wall.sql and 20261011c_characters.sql pasted into the
          Supabase SQL editor once.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={board.cast}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}
        ListHeaderComponent={
          bibles.length > 0 ? (
            <Pressable style={styles.gather} onPress={gather} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.gatherText}>{`Gather from character bibles (${bibles.length})`}</Text>}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          board.loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 30 }} />
          ) : (
            <Text style={styles.empty}>No characters yet. Gather them from your character bibles, or add one with +.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('Character', { projectId, characterId: item.id })}>
            <CharacterPicture member={item} size={54} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name || 'Unnamed'}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {bibleTitle(item.document_id) ?? (item.description ? item.description : 'No bible linked')}
              </Text>
            </View>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
          </Pressable>
        )}
      />
      <Pressable style={[styles.newBtn, { bottom: insets.bottom + 24 }]} onPress={addOne}>
        <Text style={styles.newBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center', padding: 30 },
    note: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    empty: { color: colors.textFaint, fontFamily: FONTS.handBody, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 30, paddingRight: 4 },
    gather: {
      alignItems: 'center',
      paddingVertical: 12,
      marginBottom: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.gold,
    },
    gatherText: { color: colors.gold, fontFamily: FONTS.hand, fontSize: 20, paddingRight: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderDim,
    },
    rowBody: { flex: 1, minWidth: 0 },
    rowName: { color: colors.text, fontFamily: FONTS.handBold, fontSize: 25, lineHeight: 29, paddingRight: 4 },
    rowMeta: { color: colors.textFaint, fontFamily: FONTS.handBody, fontSize: 14, paddingRight: 4 },
    swatch: { width: 16, height: 16, borderRadius: 3 },
    newBtn: {
      position: 'absolute',
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },
    newBtnText: { color: '#2b1a05', fontSize: 28, lineHeight: 32 },
  });
}
