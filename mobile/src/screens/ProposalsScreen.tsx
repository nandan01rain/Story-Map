import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type Proposal, acceptProposal, fetchProposals, rejectProposal } from '../lib/proposals';
import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { FONTS, type ThemeColors, useTheme, withOpacity } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'Proposals'>;

// What the assistants want changed, waiting for the writer (2026-10-12). Nothing on this screen
// was applied by an assistant: Accept applies it now, through the same stores the writer's own
// edits use, after checking it still fits; Reject records the no. Decided proposals stay below
// as the record of what was suggested and what was done.

const KIND_LABEL: Record<Proposal['kind'], string> = {
  edit_text: 'Edit',
  new_scene: 'New scene',
  storyboard_note: 'Storyboard note',
  link_scene_chapter: 'Scene → chapter',
  character_fields: 'Character',
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export default function ProposalsScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { proposals: list, error: err } = await fetchProposals(projectId);
    setProposals(list);
    setError(err ?? '');
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    navigation.setOptions({ title: 'Proposals' });
    void load();
  }, [navigation, load]);

  async function accept(p: Proposal) {
    if (!user) return;
    setBusy(p.id);
    const { error: err } = await acceptProposal(p, user.id);
    setBusy(null);
    if (err) setNotes((n) => ({ ...n, [p.id]: err }));
    await load();
  }

  async function reject(p: Proposal) {
    setBusy(p.id);
    const err = await rejectProposal(p);
    setBusy(null);
    if (err) setNotes((n) => ({ ...n, [p.id]: err }));
    await load();
  }

  const pending = proposals.filter((p) => p.status === 'pending');
  const decided = proposals.filter((p) => p.status !== 'pending');

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.gold} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && pending.length === 0 && (
        <Text style={styles.empty}>Nothing waiting. When Icarus or Daedalus proposes a change, it appears here for you to accept or reject.</Text>
      )}

      {pending.map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.meta}>{`${KIND_LABEL[p.kind] ?? p.kind} · ${p.agent === 'daedalus' ? 'Daedalus' : 'Icarus'} · ${new Date(p.created_at).toLocaleString()}`}</Text>
          <Text style={styles.summary}>{p.summary}</Text>
          {!!p.rationale && <Text style={styles.rationale}>{p.rationale}</Text>}
          <Detail p={p} styles={styles} />
          {!!notes[p.id] && <Text style={styles.error}>{notes[p.id]}</Text>}
          <View style={styles.actions}>
            {busy === p.id ? <ActivityIndicator color={colors.gold} /> : (
              <>
                <Pressable onPress={() => reject(p)} hitSlop={8}><Text style={styles.reject}>Reject</Text></Pressable>
                <Pressable onPress={() => accept(p)} style={styles.acceptBtn}><Text style={styles.acceptText}>Accept</Text></Pressable>
              </>
            )}
          </View>
        </View>
      ))}

      {decided.length > 0 && <Text style={styles.section}>DECIDED</Text>}
      {decided.map((p) => (
        <View key={p.id} style={[styles.card, styles.cardDone]}>
          <Text style={styles.meta}>{`${p.status.toUpperCase()} · ${KIND_LABEL[p.kind] ?? p.kind} · ${p.agent === 'daedalus' ? 'Daedalus' : 'Icarus'}`}</Text>
          <Text style={styles.summaryDone}>{p.summary}</Text>
          {p.status === 'stale' && !!str(p.payload.stale_reason) && <Text style={styles.rationale}>{str(p.payload.stale_reason)}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

/** What the proposal would do, shown plainly enough to decide on. */
function Detail({ p, styles }: { p: Proposal; styles: ReturnType<typeof makeStyles> }) {
  const pl = p.payload;
  if (p.kind === 'edit_text') {
    return (
      <View style={styles.diff}>
        <Text style={styles.diffTarget}>{`${p.target_type}: ${str(pl.title)}`}</Text>
        <Text style={styles.diffText}>
          <Text style={styles.ctx}>{str(pl.before_context) ? `…${str(pl.before_context)}` : ''}</Text>
          <Text style={styles.removed}>{str(pl.find)}</Text>
          <Text style={styles.added}>{str(pl.replace)}</Text>
          <Text style={styles.ctx}>{str(pl.after_context) ? `${str(pl.after_context)}…` : ''}</Text>
        </Text>
      </View>
    );
  }
  if (p.kind === 'new_scene') {
    return <Text style={styles.block} numberOfLines={14}>{str(pl.content)}</Text>;
  }
  if (p.kind === 'storyboard_note') {
    return <Text style={styles.block}>{`Book ${Number(pl.book) + 1} · ${str(pl.title)}\n${str(pl.summary)}`}</Text>;
  }
  if (p.kind === 'character_fields') {
    const fields = (pl.fields ?? {}) as Record<string, string>;
    const lines = [str(pl.description) ? `Card line: ${str(pl.description)}` : '', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`)].filter(Boolean);
    const added = (pl.new_fields as string[] | undefined) ?? [];
    return (
      <>
        <Text style={styles.block}>{lines.join('\n')}</Text>
        {added.length > 0 && <Text style={styles.rationale}>{`New infobox field${added.length > 1 ? 's' : ''} for every character: ${added.join(', ')}`}</Text>}
      </>
    );
  }
  return null;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    empty: { color: colors.textDim, fontSize: 13.5, lineHeight: 21, fontStyle: 'italic' },
    error: { color: '#e0764a', fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    card: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: withOpacity(colors.gold, 0.45), backgroundColor: colors.panel },
    cardDone: { borderColor: colors.borderDim, backgroundColor: 'transparent' },
    meta: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    summary: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 15, marginTop: 6 },
    summaryDone: { color: colors.textDim, fontSize: 14, marginTop: 4 },
    rationale: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
    diff: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: colors.bg },
    diffTarget: { color: colors.textFaint, fontFamily: FONTS.mono, fontSize: 10.5, marginBottom: 6 },
    diffText: { color: colors.text, fontFamily: FONTS.literary, fontSize: 14, lineHeight: 21 },
    ctx: { color: colors.textFaint },
    removed: { backgroundColor: withOpacity('#b8542e', 0.25), color: colors.textDim, textDecorationLine: 'line-through' },
    added: { backgroundColor: withOpacity('#2f9d8a', 0.25), color: colors.text },
    block: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: colors.bg, color: colors.text, fontFamily: FONTS.literary, fontSize: 13.5, lineHeight: 20 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 22, marginTop: 12 },
    reject: { color: colors.textDim, fontSize: 14 },
    acceptBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
    acceptText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    section: { color: colors.textFaint, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 2, marginTop: 14 },
  });
}
