import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

// Phase-0/1 scope: read-only list, proving real data flows from the same Supabase
// backend the PWA uses. Create/rename/delete (matching the PWA's full CRUD, see
// handoff doc §5) is Phase 1 work, not built yet.
export default function ProjectPickerScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { projects, loading, error, fetchProjects } = useProjectStore();

  useEffect(() => {
    if (user) fetchProjects(user.id);
  }, [user, fetchProjects]);

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
      {error && <Text style={styles.error}>{error}</Text>}
      {!loading && !error && projects.length === 0 && (
        <Text style={styles.empty}>No projects yet.</Text>
      )}

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowText}>{item.name}</Text>
          </View>
        )}
      />
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
  error: { color: '#b8542e', fontSize: 13, marginTop: 20 },
  empty: { color: '#a8926a', fontSize: 13, marginTop: 20 },
  row: {
    backgroundColor: '#1a130b',
    borderWidth: 1,
    borderColor: '#4a3a22',
    borderRadius: 6,
    padding: 14,
    marginBottom: 10,
  },
  rowText: { color: '#e9dcb8', fontSize: 15 },
});
