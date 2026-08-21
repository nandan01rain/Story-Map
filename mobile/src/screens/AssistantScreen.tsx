import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Icon from '../components/Icon';
import { type AgentName, type AssistantSource, type ChatTurn, askAssistant } from '../lib/assistant';
import type { SignedInStackParamList } from '../navigation/types';
import { indexStatus, useAssistantStore } from '../store/assistantStore';
import { useChapterStore } from '../store/chapterStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Assistant'>;

type Message = ChatTurn & { sources?: AssistantSource[]; agent?: AgentName };

const AGENT_BLURB: Record<AgentName, string> = {
  icarus: 'Checks the manuscript against itself — contradictions, unpaid plants, arcs gone quiet. Cites what it finds.',
  daedalus: 'Thinks about craft — structure, parallels, technique, what comparable books did and why it worked.',
};

// The two assistants share one conversation surface; which one answers is a deliberate
// choice per question rather than something routed automatically. Daedalus costs roughly
// five times what Icarus does per answer, and that is the writer's call to make, not a
// decision to hide behind a router.
export default function AssistantScreen({ route, navigation }: Props) {
  const { projectId, chapterId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const enabled = useAssistantStore((s) => s.enabled);
  const indexing = useAssistantStore((s) => s.indexing);
  const indexProgress = useAssistantStore((s) => s.indexProgress);
  const indexProject = useAssistantStore((s) => s.indexProject);
  const storeError = useAssistantStore((s) => s.lastError);

  const chapter = useChapterStore((s) => s.chapters.find((c) => c.id === chapterId));

  const [agent, setAgent] = useState<AgentName>('icarus');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [coverage, setCoverage] = useState<{ total: number; embedded: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Assistant' });
  }, [navigation]);

  useEffect(() => {
    if (enabled) indexStatus(projectId).then(setCoverage);
  }, [projectId, enabled, indexing]);

  async function send() {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    const history: ChatTurn[] = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setBusy(true);

    const { reply, error: err } = await askAssistant({
      projectId,
      agent,
      question,
      history,
      // The open chapter travels as implicit context: most questions asked mid-draft are
      // about the passage in front of the writer, and making them paste it would be absurd.
      currentChapter: chapter?.content ? `${chapter.title}\n\n${chapter.content}` : undefined,
    });

    setBusy(false);
    if (err || !reply) {
      setError(err ?? 'No answer came back.');
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: reply.text, sources: reply.sources, agent: reply.agent },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <Icon name="sparkle" size={30} color={colors.gold} />
        <Text style={styles.offTitle}>The assistant is off</Text>
        <Text style={styles.offBody}>
          Turn it on in Settings. It stays off by default, and while it is off nothing is sent anywhere and
          nothing is billed.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.primaryBtnText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  const needsIndex = coverage !== null && coverage.embedded === 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.agentRow}>
        {(['icarus', 'daedalus'] as AgentName[]).map((name) => (
          <Pressable
            key={name}
            style={[styles.agentChip, agent === name && styles.agentChipOn]}
            onPress={() => setAgent(name)}
          >
            <Text style={[styles.agentName, agent === name && styles.agentNameOn]}>
              {name === 'icarus' ? 'Icarus' : 'Daedalus'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.agentBlurb}>{AGENT_BLURB[agent]}</Text>

      {(needsIndex || indexing) && (
        <View style={styles.indexBar}>
          <Text style={styles.indexText}>
            {indexing
              ? `Indexing ${indexProgress?.done ?? 0} of ${indexProgress?.total ?? 0}…`
              : 'Nothing is indexed yet — the assistant can only see what has been indexed.'}
          </Text>
          {!indexing && (
            <Pressable onPress={() => indexProject(projectId)}>
              <Text style={styles.indexBtn}>Index now</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.thread}>
        {messages.length === 0 && (
          <Text style={styles.hint}>
            {agent === 'icarus'
              ? 'Ask what does not add up. "Does anything in this chapter contradict the character bibles?"'
              : 'Ask what you are weighing. "Would an Icarus parallel work for Dev here, and where should it stop?"'}
          </Text>
        )}

        {messages.map((message, i) => (
          <View
            key={i}
            style={[styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}
          >
            {message.role === 'assistant' && (
              <Text style={styles.bubbleAuthor}>{message.agent === 'daedalus' ? 'Daedalus' : 'Icarus'}</Text>
            )}
            <Text style={styles.bubbleText}>{message.content}</Text>
            {message.sources && message.sources.length > 0 && (
              <Text style={styles.sources}>
                Drawn from: {message.sources.map((s) => s.title || 'Untitled').join(' · ')}
              </Text>
            )}
          </View>
        ))}

        {busy && <ActivityIndicator style={{ marginTop: 12 }} color={colors.gold} />}
        {!!(error || storeError) && <Text style={styles.error}>{error || storeError}</Text>}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={agent === 'icarus' ? 'Ask Icarus to check something…' : 'Ask Daedalus…'}
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={send} disabled={busy || !draft.trim()}>
          <Icon name="feather" size={18} color="#2b1a05" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.bg },
    offTitle: { color: colors.text, fontFamily: FONTS.heading, fontSize: 19 },
    offBody: { color: colors.textDim, fontSize: 13.5, lineHeight: 21, textAlign: 'center' },
    agentRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
    agentChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    agentChipOn: { borderColor: colors.gold, backgroundColor: withOpacity(colors.gold, 0.14) },
    agentName: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 14 },
    agentNameOn: { color: colors.text },
    agentBlurb: { color: colors.textFaint, fontSize: 11.5, lineHeight: 17, paddingHorizontal: 16, paddingTop: 8 },
    indexBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      margin: 16,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
    },
    indexText: { color: colors.textDim, fontSize: 12, flex: 1, lineHeight: 17 },
    indexBtn: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 12.5 },
    thread: { padding: 16, paddingBottom: 24, gap: 12 },
    hint: { color: colors.textFaint, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
    bubble: { padding: 13, borderRadius: 10, borderWidth: 1 },
    bubbleUser: { borderColor: colors.borderDim, backgroundColor: colors.panel, alignSelf: 'flex-end', maxWidth: '92%' },
    bubbleAgent: { borderColor: withOpacity(colors.gold, 0.4), backgroundColor: 'transparent' },
    bubbleAuthor: {
      color: colors.gold,
      fontFamily: FONTS.mono,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    bubbleText: { color: colors.text, fontSize: 14.5, lineHeight: 22 },
    sources: { color: colors.textFaint, fontSize: 11, marginTop: 8, lineHeight: 16 },
    error: { color: '#e0764a', fontSize: 12.5, marginTop: 10, lineHeight: 18 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.borderDim,
      backgroundColor: colors.panel,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14.5,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 22, marginTop: 8 },
    primaryBtnText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 14 },
  });
}
