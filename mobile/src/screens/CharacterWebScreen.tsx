import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';

import Icon from '../components/Icon';
import { BRAID_HTML } from '../lib/braidHtml';
import type { SignedInStackParamList } from '../navigation/types';
import {
  type GraphData,
  createCharacter,
  createInteraction,
  fetchCharacterGraph,
  reviewCounts,
} from '../lib/characterGraph';
import { useAuthStore } from '../store/authStore';
import { useAssistantStore } from '../store/assistantStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'CharacterWeb'>;

const KIND_OPTIONS = ['confrontation', 'alliance', 'betrayal', 'mentorship', 'romantic', 'other'];

// The character web. The renderer is one HTML document shared with the PWA rather than a
// second native implementation (spec §6) -- it runs here inside a WebView and talks back
// over postMessage.
export default function CharacterWebScreen({ route, navigation }: Props) {
  const { projectId, focusNodeId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const webRef = useRef<WebView>(null);

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [error, setError] = useState('');
  const [webReady, setWebReady] = useState(false);
  const enabled = useAssistantStore((s) => s.enabled);
  const user = useAuthStore((st) => st.user);
  const [adding, setAdding] = useState<'character' | 'interaction' | null>(null);
  const [newName, setNewName] = useState('');
  const [pair, setPair] = useState<{ from?: string; to?: string }>({});
  const [kind, setKind] = useState('alliance');
  const [saving, setSaving] = useState(false);

  // The add controls live in the header rather than floating over the graph. The renderer's
  // own chip row wraps to two lines on a narrow phone -- three when the Plants & Reveals
  // filters are showing -- and anything native pinned near the top lands on top of it.
  useEffect(() => {
    navigation.setOptions({
      title: 'Character Web',
      headerRight: () => (
        <Pressable
          onPress={() => setAdding('character')}
          hitSlop={10}
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={{ color: colors.gold, fontSize: 24, lineHeight: 26 }}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation, colors.gold]);

  const load = useCallback(async () => {
    const { data, error: err } = await fetchCharacterGraph(projectId);
    if (err) setError(err);
    else setGraph(data);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // The document asks for data once it has booted; sending before that drops it silently.
  useEffect(() => {
    if (!webReady || !graph) return;
    webRef.current?.postMessage(JSON.stringify({ type: 'data', payload: graph }));

    // Reached from the Reader or the Editor, pointing at one chapter, scene or flag. No
    // lookup: those are node ids already. The renderer switches to whichever layer can draw
    // the kind it turns out to be, and ignores an id it does not know -- which is the right
    // answer for a chapter deleted since the screen was opened.
    if (focusNodeId) {
      webRef.current?.postMessage(JSON.stringify({ type: 'focus', id: focusNodeId }));
    }
  }, [webReady, graph, focusNodeId]);

  function handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') setWebReady(true);
    } catch {
      // A malformed message from the page is not worth surfacing.
    }
  }

  const review = graph ? reviewCounts(graph) : { nodes: 0, links: 0 };
  const characters = graph?.nodes.filter((n) => n.type === 'character') ?? [];

  async function saveCharacter() {
    if (!user) return;
    setSaving(true);
    const { error: err } = await createCharacter(projectId, user.id, newName);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setNewName('');
    setAdding(null);
    setError('');
    load();
  }

  async function saveInteraction() {
    if (!user || !pair.from || !pair.to) return;
    setSaving(true);
    const { error: err } = await createInteraction({
      projectId,
      userId: user.id,
      fromId: pair.from,
      toId: pair.to,
      interactionType: kind,
      valence: 'ambiguous',
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setPair({});
    setAdding(null);
    setError('');
    load();
  }

  return (
    <View style={styles.screen}>
      {!graph && !error && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}

      {!!error && (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {graph && (
        <>
          <WebView
            ref={webRef}
            style={styles.web}
            originWhitelist={['*']}
            source={{ html: BRAID_HTML }}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            // The renderer is a fixed local document; nothing here should navigate away.
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
          />

          {review.nodes + review.links > 0 && (
            <Pressable
              style={styles.reviewBar}
              onPress={() => navigation.navigate('GraphReview', { projectId })}
            >
              <Icon name="flag" size={14} color={colors.gold} />
              <Text style={styles.reviewText}>
                {review.nodes + review.links} extraction{review.nodes + review.links === 1 ? '' : 's'} to confirm
              </Text>
              <Text style={styles.reviewChevron}>›</Text>
            </Pressable>
          )}

          {graph.nodes.length === 0 && !enabled && (
            <View style={styles.offNote}>
              <Text style={styles.offText}>
                The web builds itself from your prose as you write, but extraction runs through the
                assistant — turn it on in Settings first.
              </Text>
            </View>
          )}

          {/* The state that is otherwise silent: characters and relationships exist, but no
              event has anyone placed in it, so Progression has nothing to draw. Says which
              of the two reasons it is rather than showing an empty mode. */}
          {graph.nodes.length > 0 && graph.events.length === 0 && (
            <View style={styles.hintNote}>
              <Text style={styles.hintText}>
                No events yet, so Progression is empty. A demo project loaded before this view
                existed has no events in it — load the demo again from Projects to get them.
              </Text>
            </View>
          )}

          {/* Same reasoning as the note above: an empty layer should say why it is empty.
              There are two quite different reasons here and they look identical on screen,
              so they are told apart rather than collapsed into one vague message. */}
          {graph.nodes.length > 0 && graph.events.length > 0 && graph.flags.length === 0 && (
            <View style={styles.hintNote}>
              <Text style={styles.hintText}>
                {graph.flagsSupported
                  ? 'Nothing is flagged yet, so Plants & Reveals is empty. Flag a line as a ' +
                    'plant or a reveal in the chapter editor and it appears here — or load ' +
                    'the demo project again, which arrives with 27 pairs already flagged.'
                  : 'Plants & Reveals needs a database update that has not been run yet. ' +
                    'Paste supabase/migrations/20260822_graph_flags.sql into the Supabase ' +
                    'SQL Editor and run it, then reopen this view.'}
              </Text>
            </View>
          )}
        </>
      )}

      <Modal visible={adding !== null} transparent animationType="slide" onRequestClose={() => setAdding(null)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {adding === 'character' ? 'Add a character' : 'Add a relationship'}
            </Text>

            {/* Manual authoring, so the graph is usable with no API key at all. Extraction is
                the normal way in, but a graph that can only be filled by paying is a graph
                nobody can try. */}
            {adding === 'character' && characters.length >= 2 && (
              <Pressable onPress={() => setAdding('interaction')} hitSlop={6}>
                <Text style={styles.sheetSwitch}>Add a relationship instead →</Text>
              </Pressable>
            )}

            {adding === 'character' ? (
              <TextInput
                style={styles.sheetInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                placeholderTextColor="#6d7774"
                autoFocus
                onSubmitEditing={saveCharacter}
              />
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                <Text style={styles.sheetLabel}>Between</Text>
                <View style={styles.pickRow}>
                  {characters.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.pick, pair.from === c.id && styles.pickOn]}
                      onPress={() => setPair((prev) => ({ ...prev, from: c.id }))}
                    >
                      <Text style={styles.pickText}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.sheetLabel}>And</Text>
                <View style={styles.pickRow}>
                  {characters
                    .filter((c) => c.id !== pair.from)
                    .map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.pick, pair.to === c.id && styles.pickOn]}
                        onPress={() => setPair((prev) => ({ ...prev, to: c.id }))}
                      >
                        <Text style={styles.pickText}>{c.label}</Text>
                      </Pressable>
                    ))}
                </View>

                <Text style={styles.sheetLabel}>Kind</Text>
                <View style={styles.pickRow}>
                  {KIND_OPTIONS.map((k) => (
                    <Pressable
                      key={k}
                      style={[styles.pick, kind === k && styles.pickOn]}
                      onPress={() => setKind(k)}
                    >
                      <Text style={styles.pickText}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {!!error && <Text style={styles.sheetError}>{error}</Text>}

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => {
                  setAdding(null);
                  setError('');
                }}
                hitSlop={8}
              >
                <Text style={styles.sheetCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={adding === 'character' ? saveCharacter : saveInteraction}
                disabled={saving}
                hitSlop={8}
              >
                <Text style={styles.sheetSave}>{saving ? 'Saving...' : 'Add'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#0d1110' },
    web: { flex: 1, backgroundColor: '#0d1110' },
    centered: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 },
    error: { color: '#e0764a', fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
    retry: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
    retryText: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13.5 },
    reviewBar: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withOpacity(colors.gold, 0.5),
      backgroundColor: 'rgba(15,20,19,0.92)',
    },
    reviewText: { color: '#e6ecea', fontSize: 13, flex: 1 },
    reviewChevron: { color: colors.gold, fontSize: 17 },
    offNote: { position: 'absolute', left: 20, right: 20, top: '45%' },
    offText: { color: '#8d9a97', fontSize: 13, lineHeight: 20, textAlign: 'center' },
    hintNote: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 64,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withOpacity(colors.gold, 0.45),
      backgroundColor: 'rgba(13,17,16,0.94)',
    },
    hintText: { color: '#cfd8d5', fontSize: 12.5, lineHeight: 18 },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.panel,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      padding: 20,
      gap: 12,
    },
    sheetTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 17 },
    sheetLabel: {
      color: colors.textFaint,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 10,
      marginBottom: 6,
    },
    sheetInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
    },
    pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pick: {
      borderWidth: 1,
      borderColor: colors.borderDim,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    pickOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.16) },
    pickText: { color: colors.textDim, fontSize: 12 },
    sheetError: { color: '#e0764a', fontSize: 12.5 },
    sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22, marginTop: 6 },
    sheetCancel: { color: colors.textDim, fontSize: 14 },
    sheetSave: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    sheetSwitch: { color: colors.textDim, fontSize: 12.5 },
  });
}
