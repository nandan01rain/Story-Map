import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import Icon from '../components/Icon';
import { CHARACTER_WEB_HTML } from '../lib/characterWebHtml';
import type { SignedInStackParamList } from '../navigation/types';
import { type GraphData, fetchCharacterGraph, reviewCounts } from '../lib/characterGraph';
import { useAssistantStore } from '../store/assistantStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'CharacterWeb'>;

// The character web. The renderer is one HTML document shared with the PWA rather than a
// second native implementation (spec §6) -- it runs here inside a WebView and talks back
// over postMessage.
export default function CharacterWebScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const webRef = useRef<WebView>(null);

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(null);
  const [webReady, setWebReady] = useState(false);
  const enabled = useAssistantStore((s) => s.enabled);

  useEffect(() => {
    navigation.setOptions({ title: 'Character Web' });
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
  }, [webReady, graph]);

  function handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') setWebReady(true);
      if (msg.type === 'select') setSelected(msg.id ? { id: msg.id, label: msg.label } : null);
    } catch {
      // A malformed message from the page is not worth surfacing.
    }
  }

  const review = graph ? reviewCounts(graph) : { nodes: 0, links: 0 };

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
            source={{ html: CHARACTER_WEB_HTML }}
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
        </>
      )}

      {selected && (
        <Pressable style={styles.clearSel} onPress={() => setSelected(null)}>
          <Text style={styles.clearSelText}>Showing {selected.label}</Text>
        </Pressable>
      )}
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
    clearSel: {
      position: 'absolute',
      right: 12,
      top: 56,
      backgroundColor: 'rgba(15,20,19,0.86)',
      borderColor: '#2c3634',
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 11,
    },
    clearSelText: { color: '#d8e0de', fontSize: 11 },
  });
}
