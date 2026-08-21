import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import Icon from '../components/Icon';
import {
  type GraphNode,
  type PendingEdge,
  acceptEdge,
  acceptNode,
  correctEdge,
  fetchPendingCharacters,
  fetchPendingEdges,
  mergeCharacters,
  renameCharacter,
} from '../lib/characterGraph';
import type { SignedInStackParamList } from '../navigation/types';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'GraphReview'>;

const INTERACTION_TYPES = ['confrontation', 'alliance', 'betrayal', 'mentorship', 'romantic', 'other'];

// The review queue (spec §4.4). Batched deliberately: extraction runs while writing, and
// interrupting a drafting session to confirm a relationship is worse than confirming twenty
// of them afterwards.
//
// Characters come first because a wrong character is the error that compounds -- every later
// passage attaches to the twin -- while a wrong interaction type is one row.
export default function GraphReviewScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [characters, setCharacters] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<PendingEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [merging, setMerging] = useState<GraphNode | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Confirm extractions' });
  }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    const [chars, pending] = await Promise.all([
      fetchPendingCharacters(projectId),
      fetchPendingEdges(projectId),
    ]);
    setLoading(false);
    if (chars.error || pending.error) setError(chars.error ?? pending.error ?? '');
    setCharacters(chars.nodes);
    setEdges(pending.edges);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAcceptNode(node: GraphNode) {
    setCharacters((prev) => prev.filter((n) => n.id !== node.id));
    const { error: err } = await acceptNode(node.id);
    if (err) setError(err);
  }

  async function onRename() {
    if (!renaming) return;
    const label = renaming.value.trim();
    if (!label) return;
    const { error: err } = await renameCharacter(renaming.id, label);
    setRenaming(null);
    if (err) setError(err);
    else load();
  }

  async function onMerge(survivor: GraphNode) {
    if (!merging) return;
    const duplicate = merging;
    setMerging(null);
    Alert.alert(
      'Merge characters',
      `Treat "${duplicate.label}" as another name for "${survivor.label}"? Every interaction moves ` +
        `across and the name becomes an alias, so future extractions resolve it correctly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: async () => {
            const { error: err } = await mergeCharacters(survivor.id, duplicate.id);
            if (err) setError(err);
            load();
          },
        },
      ],
    );
  }

  async function onAcceptEdge(edge: PendingEdge) {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
    const { error: err } = await acceptEdge(edge.id);
    if (err) setError(err);
  }

  async function onCorrectEdge(edge: PendingEdge, interactionType: string) {
    setEdges((prev) => prev.filter((e) => e.id !== edge.id));
    const { error: err } = await correctEdge(edge.id, {
      ...edge.properties,
      interaction_type: interactionType,
    });
    if (err) setError(err);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const nothingPending = characters.length === 0 && edges.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {nothingPending && (
        <View style={styles.empty}>
          <Icon name="sparkle" size={26} color={colors.gold} />
          <Text style={styles.emptyText}>Nothing waiting. Everything extracted so far has been confirmed.</Text>
        </View>
      )}

      {merging && (
        <View style={styles.mergeBanner}>
          <Text style={styles.mergeText}>
            Pick who “{merging.label}” actually is — tap that character below.
          </Text>
          <Pressable onPress={() => setMerging(null)} hitSlop={8}>
            <Text style={styles.mergeCancel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {characters.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>New characters</Text>
          <Text style={styles.sectionHint}>
            Each of these was seen for the first time. Confirm, rename, or fold into an existing
            character if it is the same person under another name.
          </Text>
          {characters.map((node) => (
            <View key={node.id} style={styles.card}>
              {renaming?.id === node.id ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={styles.renameInput}
                    value={renaming.value}
                    onChangeText={(v) => setRenaming({ id: node.id, value: v })}
                    autoFocus
                    onSubmitEditing={onRename}
                  />
                  <Pressable onPress={onRename} hitSlop={8}>
                    <Text style={styles.actionPrimary}>Save</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  disabled={!merging || merging.id === node.id}
                  onPress={() => onMerge(node)}
                >
                  <Text style={styles.cardTitle}>{node.label}</Text>
                </Pressable>
              )}

              {!merging && renaming?.id !== node.id && (
                <View style={styles.actions}>
                  <Pressable onPress={() => onAcceptNode(node)} hitSlop={6}>
                    <Text style={styles.actionPrimary}>Confirm</Text>
                  </Pressable>
                  <Pressable onPress={() => setRenaming({ id: node.id, value: node.label })} hitSlop={6}>
                    <Text style={styles.action}>Rename</Text>
                  </Pressable>
                  <Pressable onPress={() => setMerging(node)} hitSlop={6}>
                    <Text style={styles.action}>Same as…</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {edges.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Uncertain interactions</Text>
          <Text style={styles.sectionHint}>
            The extraction was not confident about these. Confirm, or pick what actually happened.
          </Text>
          {edges.map((edge) => (
            <View key={edge.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {edge.from?.label ?? '?'} → {edge.to?.label ?? '?'}
              </Text>
              <Text style={styles.cardMeta}>
                {String(edge.properties?.interaction_type ?? edge.edge_type)}
                {edge.properties?.valence ? ` · ${edge.properties.valence}` : ''}
                {edge.event?.label ? ` · ${edge.event.label}` : ''}
                {edge.confidence != null ? ` · ${Math.round(edge.confidence * 100)}% sure` : ''}
              </Text>
              <View style={styles.chips}>
                {INTERACTION_TYPES.map((type) => (
                  <Pressable key={type} style={styles.chip} onPress={() => onCorrectEdge(edge, type)}>
                    <Text style={styles.chipText}>{type}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => onAcceptEdge(edge)} hitSlop={6}>
                  <Text style={styles.actionPrimary}>Confirm as is</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40 },
    sectionLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10.5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 22,
    },
    sectionHint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
    card: {
      borderWidth: 1,
      borderColor: colors.borderDim,
      borderRadius: 8,
      padding: 14,
      marginBottom: 10,
      backgroundColor: colors.panel,
    },
    cardTitle: { color: colors.text, fontSize: 14.5, fontFamily: FONTS.bodySemiBold },
    cardMeta: { color: colors.textFaint, fontSize: 11.5, marginTop: 4, lineHeight: 17 },
    actions: { flexDirection: 'row', gap: 18, marginTop: 12 },
    action: { color: colors.textDim, fontSize: 13 },
    actionPrimary: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    chip: {
      borderWidth: 1,
      borderColor: colors.borderDim,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    chipText: { color: colors.textDim, fontSize: 11.5 },
    renameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    renameInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      fontSize: 14,
    },
    mergeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: withOpacity(colors.gold, 0.14),
      borderWidth: 1,
      borderColor: withOpacity(colors.gold, 0.5),
    },
    mergeText: { color: colors.text, fontSize: 12.5, flex: 1, lineHeight: 18 },
    mergeCancel: { color: colors.gold, fontSize: 12.5 },
    empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
    emptyText: { color: colors.textFaint, fontSize: 13, textAlign: 'center', lineHeight: 20 },
    error: { color: '#e0764a', fontSize: 12.5, marginBottom: 12, lineHeight: 18 },
  });
}
