import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { SignedInStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { type Project, useProjectStore } from '../store/projectStore';

type Props = NativeStackScreenProps<SignedInStackParamList, 'ProjectPicker'>;

// Matches the PWA's project-screen flow (index.html): list, create (name only,
// project_type always 'writing'), rename (inline), delete (type-the-name-to-confirm,
// hard delete, no trash -- see deleteConfirmBtn's handler and its warning copy).
export default function ProjectPickerScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { projects, loading, error, fetchProjects, createProject, renameProject, deleteProject } =
    useProjectStore();

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionError, setActionError] = useState('');

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

      {loading && <ActivityIndicator style={styles.spinner} color="#c69a3a" />}
      {(error || actionError) ? <Text style={styles.error}>{error || actionError}</Text> : null}
      {!loading && !error && projects.length === 0 && (
        <Text style={styles.empty}>No projects yet — create one below.</Text>
      )}

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ChapterList', { projectId: item.id, projectName: item.name })}
          >
            <Text style={styles.rowText}>{item.name}</Text>
            <View style={styles.rowActions}>
              <Pressable onPress={() => openRename(item)} hitSlop={10}>
                <Text style={styles.rowActionText}>Rename</Text>
              </Pressable>
              <Pressable onPress={() => openDelete(item)} hitSlop={10}>
                <Text style={[styles.rowActionText, styles.rowActionDanger]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.newRow}>
        <TextInput
          style={styles.newInput}
          value={newName}
          onChangeText={setNewName}
          placeholder="New project name"
          placeholderTextColor="#8a7355"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#120d08', padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#e9dcb8' },
  signOut: { color: '#c69a3a', fontSize: 13 },
  welcome: { color: '#a8926a', fontSize: 12, marginTop: 4, marginBottom: 20 },
  spinner: { marginTop: 20 },
  error: { color: '#b8542e', fontSize: 13, marginBottom: 12 },
  empty: { color: '#a8926a', fontSize: 13, marginTop: 20 },
  row: {
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowText: { color: '#e9dcb8', fontSize: 15, flex: 1 },
  rowActions: { flexDirection: 'row', gap: 16 },
  rowActionText: { color: '#a8926a', fontSize: 12 },
  rowActionDanger: { color: '#b8542e' },
  newRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  newInput: {
    flex: 1,
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 11,
    fontSize: 15,
    color: '#e9dcb8',
  },
  newBtn: { backgroundColor: '#c69a3a', borderRadius: 6, paddingHorizontal: 16, justifyContent: 'center' },
  newBtnText: { color: '#2b1a05', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1a130b', borderRadius: 10, padding: 20, borderWidth: 1, borderColor: '#4a3a22' },
  modalTitle: { color: '#e9dcb8', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalWarning: { color: '#a8926a', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  bold: { fontWeight: '700', color: '#e9dcb8' },
  modalHint: { color: '#a8926a', fontSize: 12, marginBottom: 6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 16 },
  modalCancel: { color: '#a8926a', fontSize: 14 },
  modalConfirm: { color: '#c69a3a', fontSize: 14, fontWeight: '700' },
  modalDanger: { color: '#b8542e' },
  modalDisabled: { opacity: 0.4 },
});
