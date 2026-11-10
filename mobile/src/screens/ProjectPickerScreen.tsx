import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import ProjectWheel, { type WheelProject } from '../components/ProjectWheel';
import type { SignedInStackParamList } from '../navigation/types';
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
// The projects are shown as THE WHEEL (2026-11-09): frames on a zoetrope drum
// (components/ProjectWheel.tsx). Touch and swipe only, by the writer's choice: swipe to turn,
// tap the front frame to open, hold a frame for Rename / Move earlier / Move later / Delete. It
// opens on the last project opened, with that project's name beneath it.
export default function ProjectPickerScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { projects, loading, error, fetchProjects, createProject, renameProject, deleteProject } =
    useProjectStore();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  // Move a project one place in the order, saved account-wide as before. The wheel turns to it.
  function move(project: Project, dir: -1 | 1) {
    const i = items.findIndex((p) => p.id === project.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setFrontId(project.id);
    void supabase.auth.updateUser({ data: { project_order: next.map((p) => p.id) } });
  }

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState('');
  // The project whose frame is being held: its options sheet is open.
  const [menuTarget, setMenuTarget] = useState<Project | null>(null);

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
            onHold={(p) => setMenuTarget(items.find((x) => x.id === p.id) ?? null)}
          />
        </View>
      )}
      {front && (
        <View style={styles.frontBox}>
          <Text style={styles.frontName} numberOfLines={2}>{front.name}</Text>
          <Text style={styles.hint}>Swipe to turn · tap the front frame to open · hold a frame for more</Text>
        </View>
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

      {/* A held frame's options. Each closes the sheet first, then acts -- a second Modal opening in
          the same instant as this one closes is the Android fault noted at confirmDelete. */}
      <Modal visible={!!menuTarget} transparent animationType="fade" onRequestClose={() => setMenuTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuTarget(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle} numberOfLines={2}>{menuTarget?.name}</Text>
            {(() => {
              const p = menuTarget;
              if (!p) return null;
              const i = items.findIndex((x) => x.id === p.id);
              const after = (fn: () => void) => () => { setMenuTarget(null); setTimeout(fn, 250); };
              return (
                <>
                  <Pressable style={styles.menuRow} onPress={after(() => openRename(p))}>
                    <Text style={styles.menuText}>Rename</Text>
                  </Pressable>
                  {i > 0 && (
                    <Pressable style={styles.menuRow} onPress={() => { move(p, -1); setMenuTarget(null); }}>
                      <Text style={styles.menuText}>Move earlier</Text>
                    </Pressable>
                  )}
                  {i < items.length - 1 && (
                    <Pressable style={styles.menuRow} onPress={() => { move(p, 1); setMenuTarget(null); }}>
                      <Text style={styles.menuText}>Move later</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.menuRow} onPress={after(() => openDelete(p))}>
                    <Text style={[styles.menuText, styles.modalDanger]}>Delete</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        </Pressable>
      </Modal>

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
    menuRow: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.borderDim },
    menuText: { color: colors.text, fontFamily: FONTS.bodySemiBold, fontSize: 15 },
    hint: { color: colors.textFaint, fontSize: 11.5, marginTop: 10 },
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
