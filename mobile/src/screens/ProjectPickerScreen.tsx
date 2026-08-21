import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DropProvider, SortableItem, useSortableList } from 'react-native-reanimated-dnd';

import type { SignedInStackParamList } from '../navigation/types';
import { type ImportProgress, demoSummary, importDemoProject } from '../lib/demoImport';
import { supabase } from '../lib/supabase';
import { useSortablePositions } from '../lib/useSortablePositions';
import { useAuthStore } from '../store/authStore';
import { type Project, useProjectStore } from '../store/projectStore';
import { FONTS, type ThemeColors, useTheme } from '../theme';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProjectPicker'>;

const ROW_HEIGHT = 56;

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

// Matches the PWA's project-screen flow (index.html): list, create (name only,
// project_type always 'writing'), rename (inline), delete (type-the-name-to-confirm,
// hard delete, no trash -- see deleteConfirmBtn's handler and its warning copy).
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

  // Drag-to-reorder, same mechanism as List view's chapter reordering (ChapterListScreen)
  // for consistency -- useSortableList rather than the higher-level <Sortable>, matching
  // that screen's fix for the nested-VirtualizedList-in-ScrollView warning, even though
  // this screen's list isn't nested in another ScrollView today; keeping one pattern
  // rather than two avoids a screen silently breaking if a wrapping ScrollView is ever
  // added around it later.
  const [items, setItems] = useState(orderedProjects);
  useEffect(() => {
    setItems(orderedProjects);
  }, [orderedProjects]);

  const handleMove = useCallback((id: string, from: number, to: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDrop = useCallback(() => {
    supabase.auth.updateUser({ data: { project_order: items.map((p) => p.id) } });
  }, [items]);


  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState('');
  const [demoProgress, setDemoProgress] = useState<ImportProgress | null>(null);

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
    setDemoProgress({ step: 'Starting', done: 0, total: 1 });
    const { projectId, projectName, error: err } = await importDemoProject(user.id, setDemoProgress);
    setDemoProgress(null);
    if (err) {
      setActionError(err);
      // A partial import still leaves a project worth looking at, so refresh either way.
      if (projectId) fetchProjects(user.id);
      return;
    }
    await fetchProjects(user.id);
    if (projectId) navigation.navigate('ChapterList', { projectId, projectName });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    const { error: err } = await deleteProject(deleteTarget.id);
    if (err) setActionError(err);
    setDeleteTarget(null);
  }

  return (
    <View style={styles.screen}>
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

      {items.length > 0 && (
        <ProjectSortableList
          items={items}
          styles={styles}
          onOpen={(item) => navigation.navigate('ChapterList', { projectId: item.id, projectName: item.name })}
          onRename={openRename}
          onDelete={openDelete}
          onMove={handleMove}
          onDrop={handleDrop}
        />
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
          </>
        )}
      </Pressable>

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
    </View>
  );
}


// The sortable list lives in its own component, mounted only once there are projects to
// show. That is the whole fix for rows drawing on top of each other on a fresh sign-in:
// useSortableList seeds its positions map with useSharedValue, which keeps whatever it was
// given on the FIRST render forever, and each row then reads its offset from that map in a
// useMemo with empty deps when it mounts. Mounting this while the fetch was still in flight
// meant the map was {} and every row read 0. Gating the mount on real data means the map is
// built from that data, the way the library assumes.
//
// (ChapterListScreen never hit this: its screen early-returns a spinner while loading, so
// its own sortable child has always mounted with chapters already in hand.)
function ProjectSortableList({
  items,
  styles,
  onOpen,
  onRename,
  onDelete,
  onMove,
  onDrop,
}: {
  items: Project[];
  styles: ReturnType<typeof makeStyles>;
  onOpen: (project: Project) => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
  onMove: (id: string, from: number, to: number) => void;
  onDrop: () => void;
}) {
  const { positions, scrollViewRef, dropProviderRef, handleScroll, handleScrollEnd, contentHeight, getItemProps } =
    useSortableList({ data: items, itemHeight: ROW_HEIGHT });
  // Still needed for the add/remove case: creating or deleting a project changes the set
  // without remounting this component.
  const listKey = useSortablePositions(items, positions);

  return (
    <DropProvider key={listKey} ref={dropProviderRef}>
      <Animated.ScrollView
        ref={scrollViewRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ height: contentHeight }}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item, index) => (
          <SortableItem key={item.id} data={item} {...getItemProps(item, index)} onMove={onMove} onDrop={onDrop}>
            <View style={styles.row}>
              <SortableItem.Handle style={styles.dragHandle}>
                <Text style={styles.dragHandleText}>⠿</Text>
              </SortableItem.Handle>
              <Pressable style={styles.rowMain} onPress={() => onOpen(item)}>
                <Text style={styles.rowText}>{item.name}</Text>
              </Pressable>
              <View style={styles.rowActions}>
                <Pressable onPress={() => onRename(item)} hitSlop={10}>
                  <Text style={styles.rowActionText}>Rename</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(item)} hitSlop={10}>
                  <Text style={[styles.rowActionText, styles.rowActionDanger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </SortableItem>
        ))}
      </Animated.ScrollView>
    </DropProvider>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 60 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontFamily: FONTS.headingBold, fontSize: 22, color: colors.text },
    signOut: { color: colors.gold, fontSize: 13 },
    welcome: { color: colors.textDim, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4, marginBottom: 20 },
    spinner: { marginTop: 20 },
    error: { color: colors.error, fontSize: 13, marginBottom: 12 },
    empty: { color: colors.textDim, fontSize: 13, marginTop: 20 },
    row: {
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      height: ROW_HEIGHT - 8,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      gap: 6,
    },
    dragHandle: { width: 28, alignItems: 'center', justifyContent: 'center' },
    dragHandleText: { color: colors.textFaint, fontSize: 16 },
    rowMain: { flex: 1 },
    rowText: { color: colors.text, fontFamily: FONTS.heading, fontSize: 15.5 },
    rowActions: { flexDirection: 'row', gap: 16 },
    rowActionText: { color: colors.textDim, fontSize: 12 },
    rowActionDanger: { color: colors.error },
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
