import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import type { Chapter } from './chapterStore';
import type { StoryDocument } from './documentStore';
import type { Scene } from './sceneStore';
import type { StoryEvent } from './storyboardStore';

// Soft delete, shared with the PWA rather than invented again.
//
// The row shape is exactly what index.html writes -- {id, user_id, project_id, type,
// payload, deleted_at} -- because both apps read the same table and a second shape would
// mean each could only restore its own deletions. The payload is keyed by type:
//
//   chapter   { chapter, scenes }   the chapter's scenes travel with it: scenes cascade on
//                                   the chapter's delete, so they have to be captured before
//                                   it or a restore brings back a chapter with nothing in it
//   scene     { scene, chapterId }
//   document  { document }
//   storyboard_event  { event, threadIds }   mobile-only; the threads it was strung on
//                                            travel with it, since its links cascade away
//
// graph_node / graph_edge rows are also trashed here by characterGraph.ts, with their own
// payload shape. They are listed but not restorable from this screen yet -- see below.

export type TrashType = 'chapter' | 'scene' | 'document' | 'storyboard_event' | 'graph_node' | 'graph_edge';

export type TrashEntry = {
  id: string;
  type: TrashType;
  deleted_at: string;
  payload: {
    chapter?: Chapter;
    scenes?: Scene[];
    scene?: Scene;
    chapterId?: string;
    document?: StoryDocument;
    event?: StoryEvent;
    threadIds?: string[];
    node?: { label?: string };
    edge?: unknown;
  };
};

type TrashState = {
  entries: TrashEntry[];
  loading: boolean;
  error: string | null;
  fetchTrash: (projectId: string) => Promise<void>;
  trashChapter: (
    projectId: string,
    userId: string,
    chapter: Chapter,
    scenes: Scene[],
  ) => Promise<{ error: string | null }>;
  trashScene: (projectId: string, userId: string, scene: Scene) => Promise<{ error: string | null }>;
  trashDocument: (
    projectId: string,
    userId: string,
    document: StoryDocument,
  ) => Promise<{ error: string | null }>;
  trashStoryEvent: (
    projectId: string,
    userId: string,
    event: StoryEvent,
    threadIds: string[],
  ) => Promise<{ error: string | null }>;
  restore: (projectId: string, userId: string, entry: TrashEntry) => Promise<{ error: string | null }>;
  purge: (id: string) => Promise<{ error: string | null }>;
  emptyTrash: (projectId: string) => Promise<{ error: string | null }>;
};

/** What the row is called on screen, and what its title is, without the caller knowing the
 *  payload's shape. */
export function describeTrash(entry: TrashEntry): { kind: string; title: string; detail: string } {
  const p = entry.payload ?? {};
  if (entry.type === 'chapter') {
    const n = p.scenes?.length ?? 0;
    return {
      kind: 'Chapter',
      title: p.chapter?.title || 'Untitled chapter',
      detail: n > 0 ? `${n} scene${n === 1 ? '' : 's'} restored with it` : 'No scenes',
    };
  }
  if (entry.type === 'scene') {
    return { kind: 'Scene', title: p.scene?.title || 'Untitled scene', detail: '' };
  }
  if (entry.type === 'document') {
    return { kind: 'Document', title: p.document?.title || 'Untitled document', detail: '' };
  }
  if (entry.type === 'storyboard_event') {
    return { kind: 'Storyboard event', title: p.event?.title || 'Untitled event', detail: '' };
  }
  if (entry.type === 'graph_node') {
    return { kind: 'Character', title: p.node?.label || 'Unnamed', detail: 'Restore from the web' };
  }
  return { kind: 'Relationship', title: 'Relationship', detail: 'Restore from the web' };
}

/** Only what this screen knows how to put back. */
export function isRestorable(entry: TrashEntry): boolean {
  return entry.type === 'chapter' || entry.type === 'scene' || entry.type === 'document' || entry.type === 'storyboard_event';
}

export const useTrashStore = create<TrashState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  fetchTrash: async (projectId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('trash')
      .select('id, type, payload, deleted_at')
      .eq('project_id', projectId)
      .order('deleted_at', { ascending: false });
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ entries: (data ?? []) as TrashEntry[], loading: false });
  },

  trashChapter: async (projectId, userId, chapter, scenes) => {
    const { error } = await supabase.from('trash').insert({
      user_id: userId,
      project_id: projectId,
      type: 'chapter',
      // Captured before the delete, not after: the FK cascades them away with the chapter.
      payload: { chapter, scenes },
      deleted_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };

    const { error: deleteError } = await supabase.from('chapters').delete().eq('id', chapter.id);
    if (deleteError) return { error: deleteError.message };
    get().fetchTrash(projectId);
    return { error: null };
  },

  trashScene: async (projectId, userId, scene) => {
    const { error } = await supabase.from('trash').insert({
      user_id: userId,
      project_id: projectId,
      type: 'scene',
      payload: { scene, chapterId: scene.chapter_id },
      deleted_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };

    const { error: deleteError } = await supabase.from('scenes').delete().eq('id', scene.id);
    if (deleteError) return { error: deleteError.message };
    get().fetchTrash(projectId);
    return { error: null };
  },

  trashDocument: async (projectId, userId, document) => {
    const { error } = await supabase.from('trash').insert({
      user_id: userId,
      project_id: projectId,
      type: 'document',
      payload: { document },
      deleted_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };

    const { error: deleteError } = await supabase.from('documents').delete().eq('id', document.id);
    if (deleteError) return { error: deleteError.message };
    get().fetchTrash(projectId);
    return { error: null };
  },

  trashStoryEvent: async (projectId, userId, event, threadIds) => {
    const { error } = await supabase.from('trash').insert({
      user_id: userId,
      project_id: projectId,
      type: 'storyboard_event',
      payload: { event, threadIds },
      deleted_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
    // The row itself is deleted by the storyboard store, which also drops it from the board.
    get().fetchTrash(projectId);
    return { error: null };
  },

  restore: async (projectId, userId, entry) => {
    const p = entry.payload ?? {};

    if (entry.type === 'chapter' && p.chapter) {
      // Rows go back under their original ids, so anything that referenced them by id --
      // a scene's chapter_id, an event node's properties.chapter_id -- still resolves.
      const { error } = await supabase.from('chapters').insert({ ...p.chapter, user_id: userId });
      if (error) return { error: error.message };
      if (p.scenes && p.scenes.length > 0) {
        const { error: sceneError } = await supabase
          .from('scenes')
          .insert(p.scenes.map((s) => ({ ...s, user_id: userId })));
        // The chapter is back and is the substance; a scene failure is worth reporting but
        // not worth refusing the restore over.
        if (sceneError) return { error: `Chapter restored, but its scenes did not: ${sceneError.message}` };
      }
    } else if (entry.type === 'scene' && p.scene) {
      // A scene whose chapter is gone has nowhere to go back to, and inserting it would
      // fail on the foreign key with a message nobody can act on.
      const { data: parent } = await supabase
        .from('chapters')
        .select('id')
        .eq('id', p.scene.chapter_id)
        .maybeSingle();
      if (!parent) {
        return {
          error: 'The chapter this scene belonged to no longer exists — restore or recreate that chapter first.',
        };
      }
      const { error } = await supabase.from('scenes').insert({ ...p.scene, user_id: userId });
      if (error) return { error: error.message };
    } else if (entry.type === 'document' && p.document) {
      const { error } = await supabase.from('documents').insert({ ...p.document, user_id: userId });
      if (error) return { error: error.message };
    } else if (entry.type === 'storyboard_event' && p.event) {
      // A chapter it pointed at may have gone since; the column is nullable, so point at
      // nothing rather than fail on the foreign key.
      let chapterId = p.event.chapter_id;
      if (chapterId) {
        const { data: ch } = await supabase.from('chapters').select('id').eq('id', chapterId).maybeSingle();
        if (!ch) chapterId = null;
      }
      const { error } = await supabase
        .from('storyboard_events')
        .insert({ ...p.event, chapter_id: chapterId, user_id: userId });
      if (error) return { error: error.message };
      // Restrung only onto threads that still exist -- a deleted thread is not recreated.
      if (p.threadIds && p.threadIds.length > 0) {
        const { data: alive } = await supabase.from('storyboard_threads').select('id').in('id', p.threadIds);
        const rows = (alive ?? []).map((t: { id: string }) => ({
          user_id: userId,
          project_id: projectId,
          thread_id: t.id,
          event_id: p.event!.id,
        }));
        if (rows.length > 0) await supabase.from('storyboard_links').insert(rows);
      }
    } else {
      return { error: 'This kind of item cannot be restored from here yet.' };
    }

    // Only once the row is actually back. Clearing the trash entry first would lose the
    // payload if the insert failed.
    const { error: purgeError } = await supabase.from('trash').delete().eq('id', entry.id);
    if (purgeError) return { error: purgeError.message };
    get().fetchTrash(projectId);
    return { error: null };
  },

  purge: async (id) => {
    const { error } = await supabase.from('trash').delete().eq('id', id);
    if (error) return { error: error.message };
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    return { error: null };
  },

  emptyTrash: async (projectId) => {
    const { error } = await supabase.from('trash').delete().eq('project_id', projectId);
    if (error) return { error: error.message };
    set({ entries: [] });
    return { error: null };
  },
}));
