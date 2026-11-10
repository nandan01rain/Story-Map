import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ProjectWheel, { type WheelProject } from '../components/ProjectWheel';
import type { SignedInStackParamList } from '../navigation/types';
import {
  type ImportProgress,
  demoSummary,
  importDemoProject,
  isDemoProject,
  removeStaleDemoProjects,
} from '../lib/demoImport';
import { supabase } from '../lib/supabase';
import { forgetLastProject, loadLastProject } from '../lib/writingPrefs';
import { useAuthStore } from '../store/authStore';
import { type Project, useProjectStore } from '../store/projectStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProjectPicker'>;

// The PWA has no project reordering at all -- `projects` has no `order` column (handoff
// doc §4) and this session has no schema/DDL access to add one (same anon-key-only
// constraint the PWA's own sessions hit). Implemented account-wide in Supabase Auth's
// user_metadata instead (`project_order`, an array of project ids), same no-migration-
// needed pattern the PWA itself uses for its own small account-level preferences
// (motion_enabled, auth_scene_mode). Any project id not yet in that array sorts after
// the ones that are, in their existing created_at order.
function applyProjectOrder(projects: Project[], orderIds: string[]): Project[] {
  const index = new Map(orderIds.map((id, i) => [id, i]));
  return [...projects].sort((a, b) => {
    const ai = index.has(a.id) ? index.get(a.id)! : Infinity;
    const bi = index.has(b.id) ? index.get(b.id)! : Infinity;
    return ai - bi;
  });
}

// Matches the PWA's project-screen flow (index.html): create (name only, project_type always
// 'writing'), rename, delete (type-the-name-to-confirm, hard delete, no trash -- see
// deleteConfirmBtn's handler and its warning copy).
//
// The projects are shown as THE WHEEL (2026-11-09): frames on a zoetrope drum, swiped round and
// tapped to open (components/ProjectWheel.tsx). It opens on the last project opened. Beneath it,
// the project at the front: Open, Rename, Delete, and ‹ › to move it earlier or later in the order
// -- which is what the drag handles of the old list did.
export default function ProjectPickerScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { projects, loading, error, fetchProjects, createProject, renameProject, deleteProject } =
    useProjectStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const demo = useMemo(() => demoSummary(), []);
  const projectOrder = (user?.user_metadata?.project_order as string[] | undefined) ?? [];
  const orderedProjects = useMemo(() => applyProjectOrder(projects, projectOrder), [projects, projectOrder]);

  const [items, setItems] = useState(orderedProjects);
  useEffect(() => {
    setItems(orderedProjects);
  }, [orderedProjects]);

  // The project at the front of the wheel. Null until the last-opened one has been looked up, so
  // the wheel's opening turn knows where to come to rest.
  const [frontId, setFrontId] = useState<string | null>(null);
  const [frontLoaded, setFrontLoaded] = useState(false);
  useEffect(() => {
    void loadLastProject().then((p) => { setFrontId(p?.id ?? null); setFrontLoaded(true); });
  }, []);
  const front = items.find((p) => p.id === frontId) ?? null;

  // ‹ › move the front project one place in the order, saved account-wide as before.
  function move(dir: -1 | 1) {
    if (!front) return;
    const i = items.indexOf(front);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    void supabase.auth.updateUser({ data: { project_order: next.map((p) => p.id) } });
  }

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState('');
  const [demoProgress, setDemoProgress] = useState<ImportProgress | null>(null);
  const [demoNote, setDemoNote] = useState('');
  const [tidying, setTidying] = useState(false);

  useEffect(() => {
    if (user) fetchProjects(user.id);
  }, [user, fetchProjects]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !user) return;
    setCreating(true);
    setActionError('');
    const { project, error: err } = await createProject(user.id, name);
    setCreating(false);
    if (err) {
      setActionError(err);
      return;
    }
    setNewName('');
    if (project) navigation.navigate('ChapterList', { projectId: project.id, projectName: project.name });
  }

  function openRename(project: Project) {
    setRenameTarget(project);
    setRenameValue(project.name);
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const { error: err } = await renameProject(renameTarget.id, name);
    if (err) setActionError(err);
    setRenameTarget(null);
  }

  function openDelete(project: Project) {
    setDeleteTarget(project);
    setDeleteConfirmText('');
  }

  // Loads the bundled demo pack into a fresh project. Deliberately additive: each run makes
  // a new project, so it can be loaded, broken while testing, and loaded again with nothing
  // to clean up first.
  async function handleLoadDemo() {
    if (!user || demoProgress) return;
    setActionError('');
    setDemoNote('');
    setDemoProgress({ step: 'Starting', done: 0, total: 1 });
    const { projectId, projectName, removed, error: err } = await importDemoProject(
      user.id,
      setDemoProgress,
    );
    setDemoProgress(null);
    // The list changes either way: a successful load replaces the older copies, a failed one
    // removes its own half-built project.
    await fetchProjects(user.id);
    if (err) {
      setActionError(err);
      return;
    }
    // Said out loud rather than assumed. The old code reported a number it had not checked,
    // so copies could pile up with the app insisting it had cleaned them.
    if (removed) setDemoNote(`Replaced ${removed} older cop${removed === 1 ? 'y' : 'ies'}.`);
    if (projectId) navigation.navigate('ChapterList', { projectId, projectName });
  }

  // Every demo project, newest first. The demo is meant to leave exactly one behind; this is
  // how the writer clears a pile that accumulated before it did, without re-importing.
  const demoProjects = useMemo(
    () =>
      projects
        .filter((p) => isDemoProject(p.name))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [projects],
  );

  async function handleTidyDemos() {
    if (!user || tidying || demoProjects.length < 2) return;
    setActionError('');
    setDemoNote('');
    setTidying(true);
    const { removed, error: err } = await removeStaleDemoProjects(user.id, demoProjects[0].id);
    setTidying(false);
    await fetchProjects(user.id);
    if (err) setActionError(err);
    else setDemoNote(`Removed ${removed} older cop${removed === 1 ? 'y' : 'ies'}.`);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    const target = deleteTarget;
    // Dismiss FIRST, and give the fade time to finish, before touching the list. Deleting
    // changes the sortable list's id-set key, which remounts everything under the modal;
    // Android's native Modal, told to hide in the same instant, was left showing its
    // backdrop over nothing -- the blank grey screen that needed a force-close (2026-09-21).
    setDeleteTarget(null);
    setDeleteConfirmText('');
    await new Promise((r) => setTimeout(r, 300));
    const { error: err } = await deleteProject(target.id);
    if (err) setActionError(err);
    else void forgetLastProject(target.id);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Your Projects</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={styles.welcome}>{user?.email}</Text>

      {loading && <ActivityIndicator style={styles.spinner} color={colors.gold} />}
      {(error || actionError) ? <Text style={styles.error}>{error || actionError}</Text> : null}
      {!loading && !error && projects.length === 0 && (
        <Text style={styles.empty}>No projects yet — create one below.</Text>
      )}

      {items.length > 0 && frontLoaded && (
        <View style={styles.wheelBleed}>
          <ProjectWheel
            projects={items}
            frontId={frontId}
            onFront={(p: WheelProject) => setFrontId(p.id)}
            onOpen={(p) => navigation.navigate('ChapterList', { projectId: p.id, projectName: p.name })}
          />
        </View>
      )}
      {front && (
        <View style={styles.frontBox}>
          <Text style={styles.frontName} numberOfLines={2}>{front.name}</Text>
          <View style={styles.frontRow}>
            <Pressable onPress={() => move(-1)} hitSlop={10} disabled={items.indexOf(front) === 0}>
              <Text style={[styles.moveText, items.indexOf(front) === 0 && styles.dim]}>‹</Text>
            </Pressable>
            <Pressable style={styles.openBtn} onPress={() => navigation.navigate('ChapterList', { projectId: front.id, projectName: front.name })}>
              <Text style={styles.openText}>Open</Text>
            </Pressable>
            <Pressable onPress={() => move(1)} hitSlop={10} disabled={items.indexOf(front) === items.length - 1}>
              <Text style={[styles.moveText, items.indexOf(front) === items.length - 1 && styles.dim]}>›</Text>
            </Pressable>
          </View>
          <View style={styles.frontLinks}>
            <Pressable onPress={() => openRename(front)} hitSlop={8}>
              <Text style={styles.linkText}>Rename</Text>
            </Pressable>
            <Pressable onPress={() => openDelete(front)} hitSlop={8}>
              <Text style={[styles.linkText, styles.linkDanger]}>Delete</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>Swipe to turn the wheel · tap the front frame to open</Text>
        </View>
      )}

      <Pressable style={styles.demoRow} onPress={handleLoadDemo} disabled={!!demoProgress}>
        {demoProgress ? (
          <>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.demoText}>
              {demoProgress.step} — {demoProgress.done} of {demoProgress.total}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.demoTitle}>Load the demo project</Text>
            <Text style={styles.demoText}>
              {demo.chapters} chapters · {demo.scenes} scenes · {demo.documents} documents ·{' '}
              {demo.words.toLocaleString()} words
            </Text>
            <Text style={styles.demoText}>
              {demo.characters} cast · {demo.relationships} relationships · {demo.pairs}{' '}
              plant/reveal pairs
            </Text>
            {!!demoNote && <Text style={styles.demoNote}>{demoNote}</Text>}
          </>
        )}
      </Pressable>

      {/* Only shown when there is actually a pile. Loading the demo already leaves one copy
          behind; this exists for the ones that accumulated before it did. */}
      {demoProjects.length > 1 && !demoProgress && (
        <Pressable style={styles.tidyRow} onPress={handleTidyDemos} disabled={tidying}>
          <Text style={styles.tidyText}>
            {tidying
              ? 'Removing…'
              : `Keep only the newest demo — delete ${demoProjects.length - 1} older cop${
                  demoProjects.length - 1 === 1 ? 'y' : 'ies'
                }`}
          </Text>
        </Pressable>
      )}

      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New project name"
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={handleCreate}
        />
        <Pressable style={styles.newBtn} onPress={handleCreate} disabled={creating}>
          {creating ? <ActivityIndicator color="#2b1a05" /> : <Text style={styles.newBtnText}>Create</Text>}
        </Pressable>
      </View>

      {/* Rename */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename project</Text>
            <TextInput
              style={styles.newInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              onSubmitEditing={confirmRename}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setRenameTarget(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmRename}>
                <Text style={styles.modalConfirm}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete -- type-to-confirm, matches the PWA's deleteConfirmInput gate exactly */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete project</Text>
            <Text style={styles.modalWarning}>
              This will permanently delete <Text style={styles.bold}>{deleteTarget?.name}</Text> — every chapter,
              scene, document, and sticky note inside it. This cannot be undone; there is no trash or recovery step
              for this.
            </Text>
            <Text style={styles.modalHint}>Type "{deleteTarget?.name}" to confirm:</Text>
            <TextInput
              style={styles.newInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoFocus
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteTarget(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} disabled={deleteConfirmText !== deleteTarget?.name}>
                <Text
                  style={[
                    styles.modalConfirm,
                    styles.modalDanger,
                    deleteConfirmText !== deleteTarget?.name && styles.modalDisabled,
                  ]}
                >
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}


function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    screenBody: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontFamily: FONTS.headingBold, fontSize: 22, color: colors.text },
    signOut: { color: colors.gold, fontSize: 13 },
    welcome: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4, marginBottom: 20 },
    spinner: { marginTop: 20 },
    error: { color: colors.error, fontSize: 13, marginBottom: 12 },
    empty: { color: colors.textDim, fontSize: 13, marginTop: 20 },
    // The wheel runs the full width of the screen, past this screen's padding.
    wheelBleed: { marginHorizontal: -20, marginTop: 4 },
    frontBox: { alignItems: 'center', marginTop: 4, marginBottom: 18 },
    frontName: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 18, textAlign: 'center' },
    frontRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 10 },
    moveText: { color: colors.gold, fontSize: 30, lineHeight: 32, paddingHorizontal: 6 },
    dim: { opacity: 0.25 },
    openBtn: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 30, paddingVertical: 9 },
    openText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold, fontSize: 15 },
    frontLinks: { flexDirection: 'row', gap: 22, marginTop: 10 },
    linkText: { color: colors.textDim, fontSize: 13 },
    linkDanger: { color: colors.error },
    hint: { color: colors.textFaint, fontSize: 11.5, marginTop: 10 },
    demoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderDim,
    },
    demoTitle: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 13.5 },
    demoText: { color: colors.textFaint, fontSize: 11.5, flexShrink: 1 },
    demoNote: { color: colors.gold, fontSize: 11.5, marginTop: 4 },
    tidyRow: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderDim,
    },
    tidyText: { color: colors.textDim, fontSize: 12.5 },
    newRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    newInput: {
      flex: 1,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 11,
      fontSize: 15,
      color: colors.text,
    },
    newBtn: { backgroundColor: colors.gold, borderRadius: 6, paddingHorizontal: 16, justifyContent: 'center' },
    newBtnText: { color: '#2b1a05', fontFamily: FONTS.bodySemiBold },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: colors.panel, borderRadius: 10, padding: 20, borderWidth: 1, borderColor: colors.border },
    modalTitle: { color: colors.text, fontFamily: FONTS.headingBold, fontSize: 17, marginBottom: 12 },
    modalWarning: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    bold: { fontFamily: FONTS.bodySemiBold, color: colors.text },
    modalHint: { color: colors.textDim, fontSize: 12, marginBottom: 6 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 16 },
    modalCancel: { color: colors.textDim, fontSize: 14 },
    modalConfirm: { color: colors.gold, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
    modalDanger: { color: colors.error },
    modalDisabled: { opacity: 0.4 },
  });
}
