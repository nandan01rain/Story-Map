import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type Props = NativeStackScreenProps<SignedInStackParamList, 'Braid'>;

const KIND_OPTIONS = ['confrontation', 'alliance', 'betrayal', 'mentorship', 'romantic', 'other'];

// The braid. The renderer is one HTML document shared with the PWA rather than a
// second native implementation (spec §6) -- it runs here inside a WebView and talks back
// over postMessage.
export default function BraidScreen({ route, navigation }: Props) {
  const { projectId, focusNodeId } = route.params;

  // The braid reads along a long horizontal axis, so this one screen turns the device
  // rather than asking the reader to. Locked on entry, released on the way out, so the
  // rest of the app keeps the portrait it is designed for.
  //
  // This needs app.json's orientation to be "default": with it set to "portrait" the OS
  // refuses every rotation and the lock below silently does nothing.
  useEffect(() => {
    let cancelled = false;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {
      // A device that will not rotate is not a reason to fail to draw the braid; it just
      // shows a narrower slice of the axis, which pans like any other view.
    });
    return () => {
      cancelled = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      void cancelled;
    };
  }, []);
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();

  // The braid is the whole screen, so the system bars go away while it is open -- and come
  // back the moment it is left. Removing the app's own header exposed the problem rather
  // than causing it: the renderer's Layers / Show / View / Find row sits at the very top of
  // its document, which put it under the notification bar, and the navigation bar sat over
  // the legend and scrubber at the bottom. Neither was reachable.
  //
  // Restored on blur rather than on unmount: this screen can be navigated away from and back
  // to without unmounting, and a reader left with no navigation bar on some other screen
  // would be a far worse bug than the one being fixed.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      }
      return () => {
        cancelled = true;
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(() => {});
        }
        void cancelled;
      };
    }, []),
  );
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

  // NO native header. The braid is read in landscape, where a header bar cost about a fifth
  // of the screen to repeat a title the renderer already draws in its own top line -- and the
  // picture is the entire point of the screen. The two controls it carried become glyphs
  // overlaid on the canvas instead, in the corners the renderer leaves empty.
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
      // The return leg. The braid could always be reached FROM the Reader and the Editor at
      // any granularity, and could never send anyone back -- it was the one surface in the
      // app that was a dead end. The renderer asks; this decides what "open" means.
      //
      // The Reader rather than the Editor, deliberately: arriving from a structural view,
      // the question is almost always "what does this actually say", and the Reader can hand
      // over to the Editor itself. `jumpToText` is the flag's own anchored substring, so it
      // lands on the line rather than the top of the chapter.
      if (msg.type === 'open' && msg.chapterId) {
        navigation.navigate('Reader', {
          projectId,
          chapterId: msg.chapterId,
          jumpToText: msg.text || undefined,
        });
      }
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
          {/* Hidden, not merely translucent: a translucent bar still reserves its height on
              Android and the renderer's top row would stay underneath it. */}
          <StatusBar hidden />
          <WebView
            // Keyed on the theme: the renderer reads it once at module scope, so a change has
            // to remount the document rather than be posted into a running one.
            key={mode}
            ref={webRef}
            // A display cutout survives hiding the bars, and in landscape it is on the side
            // rather than the top -- which is exactly where the braid is read. Padding the
            // WebView keeps the renderer's own chrome clear of it without the renderer
            // needing to know anything about phones.
            style={[styles.web, {
              paddingTop: insets.top,
              paddingLeft: insets.left,
              paddingRight: insets.right,
              paddingBottom: insets.bottom,
            }]}
            originWhitelist={['*']}
            source={{ html: BRAID_HTML }}
            // Before the document's own scripts run, so THEME is already decided when they do.
            injectedJavaScriptBeforeContentLoaded={`window.__THEME__=${JSON.stringify(mode)};true;`}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            // The renderer is a fixed local document; nothing here should navigate away.
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
          />

          {/* The two native controls, as glyphs over the canvas rather than a header band. */}
          <Pressable
            style={[styles.corner, styles.cornerLeft, { top: insets.top + 6, left: insets.left + 4 }]}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <Text style={styles.cornerGlyph}>‹</Text>
          </Pressable>
          <Pressable
            style={[styles.corner, styles.cornerRight, { top: insets.top + 6, right: insets.right + 4 }]}
            onPress={() => setAdding('character')}
            hitSlop={12}
          >
            <Text style={styles.cornerGlyph}>+</Text>
          </Pressable>

          {/* Was a bar reading "N extractions to confirm", pinned across the bottom over the
              renderer's own legend and scrubber. Two faults: it spent scarce landscape height
              on chrome, and it displayed A COUNT OF PENDING WORK on a surface the writer is
              supposed to want to open -- which is exactly the thing that turns a map into a
              queue and a queue into something avoided. Now a single unlabelled flag beside
              the other corner glyphs: reachable, not insistent. */}
          {review.nodes + review.links > 0 && (
            <Pressable
              style={[styles.corner, styles.cornerFlag, { top: insets.top + 6, right: insets.right + 46 }]}
              onPress={() => navigation.navigate('GraphReview', { projectId })}
              hitSlop={12}
            >
              <Icon name="flag" size={15} color={colors.gold} />
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
    // Corner glyphs, deliberately low-contrast and small: the picture is the screen, and
    // chrome over it should be findable without competing with a thread.
    corner: {
      position: 'absolute',
      top: 6,   // offset further by the safe-area inset at the call site
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cornerLeft: { left: 4 },
    cornerRight: { right: 4 },
    cornerFlag: { right: 46 },
    cornerGlyph: { color: colors.gold, fontSize: 26, lineHeight: 28, opacity: 0.85 },
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
