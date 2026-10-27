import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { JOURNAL_HTML } from '../lib/journalHtml';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useJournalStore } from '../store/journalStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'JournalScan'>;

type Part = { dataUrl: string; width: number; height: number };

// Pages from the paper notebook, scanned in. The writer picks photographs; each goes through the
// kit's scanner (drag the four corners, turn it, split a spread at the binding) and every page
// that comes out is stored as a picture and becomes a journal page dated today.
//
// CAPTURED, NOT CORRECTED: nothing is read off the page and nothing is cleaned up unless the
// writer ticks "even out the light". Mirror writing, sideways writing, crossings-out, stains --
// the page arrives as it was written. Photos are chosen from the phone's files and gallery; taking
// one straight from the camera needs expo-image-picker, which waits for the next native build.
export default function JournalScanScreen({ route, navigation }: Props) {
  const projectId = route.params?.projectId;
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const web = useRef<WebView>(null);
  const queue = useRef<DocumentPicker.DocumentPickerAsset[]>([]);
  const made = useRef<string[]>([]);
  const [status, setStatus] = useState('Choose photographs of your pages…');
  const [ready, setReady] = useState(false);

  // Picked once the scanner's document is up, so the first photo has somewhere to go.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true, multiple: true });
      if (res.canceled || !res.assets?.length) return navigation.goBack();
      queue.current = [...res.assets];
      void next();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function next() {
    const a = queue.current.shift();
    if (!a) return finish();
    setStatus('Opening the photograph…');
    try {
      const b64 = await new File(a.uri).base64();
      const mime = a.mimeType ?? 'image/jpeg';
      setStatus('');
      web.current?.postMessage(JSON.stringify({ type: 'scan', src: `data:${mime};base64,${b64}`, spread: false }));
    } catch (e) {
      Alert.alert('That photograph could not be read', e instanceof Error ? e.message : '');
      void next();
    }
  }

  async function keep(parts: Part[]) {
    if (!user) return;
    setStatus(parts.length > 1 ? 'Keeping both pages…' : 'Keeping the page…');
    const store = useJournalStore.getState();
    for (const part of parts) {
      const base64 = part.dataUrl.slice(part.dataUrl.indexOf(',') + 1);
      const up = await store.upload({ userId: user.id, base64, ext: 'jpg', mimeType: 'image/jpeg', prefix: 'scan-' });
      if (up.error || !up.path) {
        Alert.alert('Scan not kept', up.error ?? 'Try again.');
        queue.current = [];
        return finish();
      }
      const { page, error } = await store.create({ userId: user.id, fields: { scan_path: up.path, paper: 'plain' } });
      if (error || !page) {
        Alert.alert('Scan stored, page not made', error ?? 'Try again.');
        queue.current = [];
        return finish();
      }
      made.current.push(page.id);
    }
    void next();
  }

  function finish() {
    const n = made.current.length;
    if (n === 1) navigation.replace('JournalPage', { projectId, pageId: made.current[0] });
    else navigation.goBack();
  }

  function onMessage(raw: string) {
    let m: { type: string; parts?: Part[]; error?: string };
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'scanned' && m.parts) void keep(m.parts);
    else if (m.type === 'scanCancel') {
      if (m.error) Alert.alert('Not scanned', m.error);
      void next();
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <WebView
        ref={web}
        style={styles.web}
        originWhitelist={['*']}
        source={{ html: JOURNAL_HTML }}
        onMessage={(e) => onMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
      />
      {!!status && (
        <View style={styles.cover}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.status}>{status}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#1a140e' },
    web: { flex: 1, backgroundColor: '#1a140e' },
    cover: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#1a140e', alignItems: 'center', justifyContent: 'center', gap: 14 },
    status: { color: colors.textDim, fontFamily: FONTS.literaryItalic, fontStyle: 'italic', fontSize: 15 },
  });
}
