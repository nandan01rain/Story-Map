import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { CharacterPicture } from '../components/CharacterCard';
import { MarkdownBlock, type MarkdownLook } from '../components/MarkdownBlock';
import { parseMarkdown, type Block } from '../lib/markdown';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { documentType, type StoryDocument, useDocumentStore } from '../store/documentStore';
import { CAST_COLORS, useStoryboardStore } from '../store/storyboardStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Character'>;

// A character's page, laid out as a wiki article (2026-10-11): the name and a one-line tagline,
// then an INFOBOX -- a bar in the character's colour, their picture, and "Biographical
// information" as label/value rows -- then their character bible rendered below as the article,
// with its contents listed and tappable.
//
// The infobox rows are the project's own (character_fields): "+ Add a field" adds the row to
// EVERY character, each filling in its own value; hold a row's label to rename or remove it.
// The tagline is the same few words the flashcard shows. The picture comes from the phone through
// the file picker the app already carries, so no new build was needed for it.
export default function CharacterScreen({ route, navigation }: Props) {
  const { projectId, characterId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const board = useStoryboardStore();
  const { documents, fetchDocuments, fetchDocument } = useDocumentStore();
  const member = board.cast.find((c) => c.id === characterId) ?? null;

  const [name, setName] = useState(member?.name ?? '');
  const [tagline, setTagline] = useState(member?.description ?? '');
  const [values, setValues] = useState<Record<string, string>>(member?.fields ?? {});
  const [uploading, setUploading] = useState(false);
  const [showColours, setShowColours] = useState(false);
  const [linking, setLinking] = useState(false);
  const [newField, setNewField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; name: string } | null>(null);
  const [bible, setBible] = useState<StoryDocument | null>(null);
  const [showContents, setShowContents] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const headingY = useRef<Record<number, number>>({});
  const articleY = useRef(0);

  useEffect(() => {
    navigation.setOptions({ title: '' });
    if (board.projectId !== projectId) void board.fetch(projectId);
    if (documents.length === 0) void fetchDocuments(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setTagline(member.description ?? '');
    setValues(member.fields ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  // The article: the linked bible, fetched whole (the library list carries no text).
  useEffect(() => {
    let alive = true;
    setBible(null);
    if (member?.document_id) void fetchDocument(member.document_id).then(({ document }) => alive && setBible(document));
    return () => {
      alive = false;
    };
  }, [member?.document_id, fetchDocument]);

  const blocks = useMemo<Block[]>(() => (bible ? parseMarkdown(bible.content ?? '') : []), [bible]);
  const contents = useMemo(
    () => blocks.map((b, i) => ({ b, i })).filter((x): x is { b: Extract<Block, { kind: 'heading' }>; i: number } => x.b.kind === 'heading' && x.b.level <= 2),
    [blocks],
  );
  const look: MarkdownLook = useMemo(
    () => ({ colors, fontFamily: FONTS.literary, fontSize: 16, lineHeight: 25, align: 'left' }),
    [colors],
  );

  if (!member) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const bibleChoices = documents.filter(
    (d) => documentType(d.type) !== 'Archive' && (documentType(d.type) === 'Character Bible' || /Character —/.test(d.title)),
  );
  const pictureW = Math.min(width - 64, 340);
  const needsMigration = !board.charactersSupported;

  async function pickPicture() {
    if (!user) return;
    if (needsMigration) return Alert.alert('One step first', 'Paste supabase/migrations/20261011c_characters.sql into the Supabase SQL editor once.');
    const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    const ext = (a.name.split('.').pop() || 'jpg').toLowerCase();
    setUploading(true);
    const { error } = await board.setCastImage({ userId: user.id, castId: member!.id, uri: a.uri, mimeType: a.mimeType ?? `image/${ext}`, ext });
    setUploading(false);
    if (error) Alert.alert('Picture not saved', error);
  }

  async function addField() {
    if (!user || !newField?.trim()) return setNewField(null);
    const { error } = await board.addCharacterField({ projectId, userId: user.id, name: newField.trim() });
    if (error) Alert.alert('Field not added', error);
    setNewField(null);
  }

  function remove() {
    Alert.alert(`Remove ${member!.name || 'this character'}?`, 'Their notes stay on the storyboard and go back to plain yellow. Their bible is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await board.removeCast(member!.id);
          if (error) Alert.alert('Not removed', error);
          else navigation.goBack();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.title}
          value={name}
          onChangeText={setName}
          onEndEditing={() => name.trim() !== member.name && void board.updateCast(member.id, { name: name.trim() })}
          placeholder="Name"
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <TextInput
          style={styles.tagline}
          value={tagline}
          onChangeText={setTagline}
          onEndEditing={() => tagline !== (member.description ?? '') && void board.updateCast(member.id, { description: tagline.trim() })}
          placeholder="A few words — the line on their card"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        {/* The infobox. */}
        <View style={styles.infobox}>
          <View style={[styles.infoHead, { backgroundColor: member.color }]}>
            <Text style={styles.infoHeadText} numberOfLines={2}>
              {member.name || 'Unnamed'}
            </Text>
          </View>
          <Pressable onPress={pickPicture} disabled={uploading} style={styles.pictureWrap}>
            <CharacterPicture member={member} size={pictureW} height={pictureW * 1.2} radius={0} />
            <Text style={styles.pictureHint}>{uploading ? 'Uploading…' : member.image_path ? 'Tap to change picture' : 'Tap to add a picture'}</Text>
          </Pressable>

          <View style={styles.sectionBar}>
            <Text style={styles.sectionBarText}>Biographical information</Text>
          </View>
          {board.characterFields.map((f) =>
            editingField?.id === f.id ? (
              <View key={f.id} style={styles.fieldEdit}>
                <TextInput
                  style={styles.fieldEditInput}
                  value={editingField.name}
                  onChangeText={(t) => setEditingField({ id: f.id, name: t })}
                  autoFocus
                />
                <Pressable
                  onPress={() => {
                    if (editingField.name.trim()) void board.renameCharacterField(f.id, editingField.name.trim());
                    setEditingField(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.small}>Save</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert(`Remove "${f.name}"?`, 'The row goes from every character.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          setEditingField(null);
                          void board.removeCharacterField(f.id);
                        },
                      },
                    ])
                  }
                  hitSlop={8}
                >
                  <Text style={styles.dangerSmall}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View key={f.id} style={styles.fieldRow}>
                <Pressable style={[styles.fieldLabel, { backgroundColor: withOpacity(member.color, 0.55) }]} onLongPress={() => setEditingField({ id: f.id, name: f.name })}>
                  <Text style={styles.fieldLabelText}>{f.name}</Text>
                </Pressable>
                <TextInput
                  style={styles.fieldValue}
                  value={values[f.id] ?? ''}
                  onChangeText={(t) => setValues({ ...values, [f.id]: t })}
                  onEndEditing={() => (values[f.id] ?? '') !== (member.fields?.[f.id] ?? '') && void board.setFieldValue(member.id, f.id, (values[f.id] ?? '').trim())}
                  placeholder="—"
                  placeholderTextColor={colors.textFaint}
                  multiline
                />
              </View>
            ),
          )}
          {newField !== null ? (
            <View style={styles.fieldEdit}>
              <TextInput
                style={styles.fieldEditInput}
                value={newField}
                onChangeText={setNewField}
                placeholder="Field name, e.g. Alias"
                placeholderTextColor={colors.textFaint}
                autoFocus
                onSubmitEditing={addField}
              />
              <Pressable onPress={addField} hitSlop={8}>
                <Text style={styles.small}>Add</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => (needsMigration ? Alert.alert('One step first', 'Paste supabase/migrations/20261011c_characters.sql into the Supabase SQL editor once.') : setNewField(''))} style={styles.addField}>
              <Text style={styles.small}>+ Add a field (for every character)</Text>
            </Pressable>
          )}
          {board.characterFields.length > 0 && <Text style={styles.hint}>Hold a field's name to rename or remove it.</Text>}

          <Pressable onPress={() => setShowColours(!showColours)} style={styles.colourRow}>
            <Text style={styles.fieldLabelText}>Colour on the storyboard</Text>
            <View style={[styles.dot, { backgroundColor: member.color }]} />
          </Pressable>
          {showColours && (
            <View style={styles.swatches}>
              {CAST_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => void board.updateCast(member.id, { color: c })}
                  style={[styles.swatch, { backgroundColor: c }, member.color === c && { borderColor: colors.text }]}
                />
              ))}
            </View>
          )}
        </View>

        {/* The article: their bible. */}
        <View style={styles.bibleHead}>
          <Text style={styles.bibleLabel}>Character bible</Text>
          <Pressable onPress={() => setLinking(!linking)} hitSlop={8}>
            <Text style={styles.small}>{linking ? 'Close' : member.document_id ? 'Change' : 'Link one'}</Text>
          </Pressable>
        </View>
        {linking && (
          <View style={styles.chips}>
            {bibleChoices.map((d) => (
              <Pressable
                key={d.id}
                style={[styles.chip, d.id === member.document_id && styles.chipOn]}
                onPress={() => {
                  void board.updateCast(member.id, { document_id: d.id });
                  setLinking(false);
                }}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {d.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {member.document_id && !bible ? <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} /> : null}
        {bible && (
          <View onLayout={(e) => (articleY.current = e.nativeEvent.layout.y)}>
            {contents.length > 2 && (
              <View style={styles.contents}>
                <Pressable onPress={() => setShowContents(!showContents)} style={styles.contentsHead}>
                  <Text style={styles.contentsTitle}>Contents</Text>
                  <Text style={styles.small}>{showContents ? 'hide' : 'show'}</Text>
                </Pressable>
                {showContents &&
                  contents.map((c, n) => (
                    <Pressable
                      key={c.i}
                      onPress={() => {
                        const y = headingY.current[c.i];
                        if (y != null) scrollRef.current?.scrollTo({ y: articleY.current + y - 10, animated: true });
                      }}
                    >
                      <Text style={[styles.contentsItem, c.b.level === 2 && { paddingLeft: 16 }]} numberOfLines={1}>
                        {`${n + 1}. ${c.b.plain}`}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}
            {blocks.map((b, i) => (
              <View key={`${i}:${b.at}`} onLayout={b.kind === 'heading' ? (e) => (headingY.current[i] = e.nativeEvent.layout.y) : undefined}>
                <MarkdownBlock block={b} look={look} />
              </View>
            ))}
          </View>
        )}

        {needsMigration && (
          <Text style={styles.warn}>
            Pictures, fields, the tagline and the bible link save once supabase/migrations/20261011c_characters.sql has been pasted into the Supabase SQL editor.
          </Text>
        )}

        <Pressable onPress={remove} style={{ marginTop: 34 }} hitSlop={8}>
          <Text style={styles.danger}>Remove character</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { alignItems: 'center', justifyContent: 'center' },
    body: { padding: 18, paddingBottom: 60 },
    title: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 28, letterSpacing: 0.5, paddingVertical: 2 },
    tagline: { color: colors.textDim, fontFamily: FONTS.literaryItalic, fontSize: 16, lineHeight: 23, paddingVertical: 2, marginBottom: 14 },
    infobox: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.panel },
    infoHead: { paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
    infoHeadText: { color: '#2a2119', fontFamily: FONTS.headingBold, fontSize: 20, textAlign: 'center' },
    pictureWrap: { alignItems: 'center', paddingVertical: 12 },
    pictureHint: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 12, marginTop: 6 },
    sectionBar: { backgroundColor: colors.text, paddingVertical: 7 },
    sectionBarText: { color: colors.bg, fontFamily: FONTS.headingBold, fontSize: 14, textAlign: 'center', letterSpacing: 0.5 },
    fieldRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim },
    fieldLabel: { width: '36%', paddingVertical: 9, paddingHorizontal: 10, justifyContent: 'center' },
    fieldLabelText: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    fieldValue: { flex: 1, color: colors.text, fontFamily: FONTS.body, fontSize: 14.5, paddingVertical: 8, paddingHorizontal: 10 },
    fieldEdit: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim },
    fieldEditInput: { flex: 1, color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 14, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.gold },
    addField: { paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim },
    hint: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 11.5, paddingHorizontal: 10, paddingBottom: 8 },
    colourRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDim },
    dot: { width: 18, height: 18, borderRadius: 9 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 10, paddingBottom: 12 },
    swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
    bibleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderDim, paddingBottom: 6 },
    bibleLabel: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 13, letterSpacing: 2 },
    small: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13.5 },
    dangerSmall: { color: colors.error, fontFamily: FONTS.body, fontSize: 13.5 },
    chips: { gap: 6, marginBottom: 10 },
    chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.borderDim },
    chipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.12) },
    chipText: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 14 },
    contents: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginVertical: 12, backgroundColor: colors.panel },
    contentsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    contentsTitle: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 15 },
    contentsItem: { color: colors.textDim, fontFamily: FONTS.body, fontSize: 14.5, paddingVertical: 4 },
    warn: { color: colors.textFaint, fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, marginTop: 18 },
    danger: { color: colors.error, fontFamily: FONTS.body, fontSize: 14 },
  });
}
