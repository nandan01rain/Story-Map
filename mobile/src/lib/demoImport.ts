import { DEMO_FIXTURE } from './demoFixture';
import { supabase } from './supabase';

// Loads the demo pack into a brand-new project.
//
// This runs in the app rather than from a script on the developer's machine because every
// table is behind row-level security: rows are written with the signed-in user's id and
// readable only by them. A script holding the anon key has no session, so its inserts are
// rejected — correctly. The app already has the session.
//
// Each run creates a separate project rather than updating one in place, so the demo can be
// loaded, wrecked while testing, and loaded again. Exactly one demo project survives a run:
// removeStaleDemoProjects() deletes the rest on success, and a failed run deletes its own
// half-built project instead.

export type ImportProgress = { step: string; done: number; total: number };

/** Every project whose name this demo owns. Nothing else is ever a candidate for removal. */
export function isDemoProject(name: string): boolean {
  return typeof name === 'string' && name.startsWith(DEMO_FIXTURE.projectName);
}

/**
 * Deletes every demo project except `keepId`.
 *
 * Split out of the import and rewritten because the old version could fail without saying
 * so, in three separate places, and repeated loads left a pile of timestamped copies behind
 * with nothing anywhere reporting why:
 *
 *  - the read that found them discarded its error, so a failed read looked like "no old
 *    copies exist";
 *  - the delete reported success as `stale.length` rather than as what the database actually
 *    removed -- and a delete refused by row-level security returns no error and no rows, so
 *    a blocked delete was indistinguishable from a completed one;
 *  - it ran only on the success path, so any import that failed part-way left its project
 *    behind permanently.
 *
 * Matching is done here in JS rather than with a `like` filter. The filter itself is fine --
 * the name has parentheses in it, and those survive the round trip -- but a client-side
 * `startsWith` cannot be wrong about escaping, and a writer has few enough projects that
 * reading them all costs nothing.
 */
export async function removeStaleDemoProjects(
  userId: string,
  keepId: string | null,
): Promise<{ removed: number; error: string | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId);
  if (error) return { removed: 0, error: `Could not check for older demo copies: ${error.message}` };

  const stale = (data ?? []).filter((row) => isDemoProject(row.name as string) && row.id !== keepId);
  if (stale.length === 0) return { removed: 0, error: null };

  const ids = stale.map((row) => row.id as string);
  const { data: deleted, error: deleteError } = await supabase
    .from('projects')
    .delete()
    .in('id', ids)
    // Returns the rows that were actually deleted, which is the only honest source for the
    // count. Without it a delete that removed nothing still reported a number.
    .select('id');
  if (deleteError) {
    return { removed: 0, error: `Could not delete older demo copies: ${deleteError.message}` };
  }

  const removed = deleted?.length ?? 0;
  if (removed < ids.length) {
    // The shape a permissions problem takes: no error, no rows. Said plainly rather than
    // reported as a success that leaves the copies on screen.
    return {
      removed,
      error:
        `${ids.length - removed} older demo project${ids.length - removed === 1 ? '' : 's'} ` +
        'could not be deleted. The database refused the delete without giving a reason, which ' +
        'usually means the projects table has no delete policy for your account.',
    };
  }
  return { removed, error: null };
}

export async function importDemoProject(
  userId: string,
  onProgress: (p: ImportProgress) => void,
): Promise<{ projectId: string | null; projectName: string; removed?: number; error: string | null }> {
  const fixture = DEMO_FIXTURE;
  const total = fixture.chapters.length + fixture.documents.length + 2;
  let done = 0;

  const tick = (step: string) => {
    done += 1;
    onProgress({ step, done, total });
  };

  // A timestamp suffix keeps repeated loads distinguishable in the project list.
  const stamp = new Date().toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const projectName = `${fixture.projectName} · ${stamp}`;

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ user_id: userId, name: projectName, project_type: 'writing' })
    .select()
    .single();
  if (projectError || !project) {
    return { projectId: null, projectName, error: projectError?.message ?? 'Could not create the project.' };
  }
  tick('Project created');

  // Every exit from here on goes through finish(), so no path can leave a project behind
  // by forgetting to tidy up. There were seven such paths and only the last one cleaned up.
  //
  // This reverses an earlier deliberate choice to keep a half-imported project around for
  // inspection. That was defensible once; it is not defensible after it has produced a pile
  // of timestamped copies, and the error message says what failed either way, which was the
  // actual point of keeping it.
  const finish = async (
    result: { projectId: string | null; projectName: string; error: string | null },
  ) => {
    if (result.error !== null) {
      // Only the half-built project goes. Whatever demo was there before is left exactly as
      // it was -- discarding a working copy in favour of a broken one would be the wrong way
      // round, and a failed load should leave the writer no worse off than before they
      // tapped it.
      await supabase.from('projects').delete().eq('id', project.id);
      return { ...result, projectId: null, removed: 0 };
    }
    const { removed, error: cleanupError } = await removeStaleDemoProjects(userId, project.id);
    // A cleanup problem is not an import problem -- the new demo is complete and usable --
    // but it is still surfaced, because copies quietly piling up is precisely what went
    // unnoticed before.
    return { ...result, removed, error: cleanupError };
  };

  // Chapters in one insert rather than seventeen round trips. `order` is the chapter number,
  // so Chapter 0 (the prologue) keeps its place ahead of Chapter 1 instead of being renumbered.
  const chapterRows = fixture.chapters.map((c) => ({
    user_id: userId,
    project_id: project.id,
    book: 0,
    act: c.act,
    order: c.number,
    title: c.title,
    status: 'drafted',
    content: c.content,
    notes: c.notes,
    // The plant/reveal pairs, flagged into the prose itself. They are what the character
    // web's Plants & Reveals layer reads -- it derives them from the chapters rather than
    // storing a second copy in the graph, so flagging a line in the editor puts it on the
    // web with no sync step.
    annotations: c.annotations,
    versions: [],
  }));

  const { data: insertedChapters, error: chapterError } = await supabase
    .from('chapters')
    .insert(chapterRows)
    .select('id, "order"');
  if (chapterError) {
    return finish({ projectId: project.id, projectName, error: `Chapters: ${chapterError.message}` });
  }
  fixture.chapters.forEach(() => tick('Chapters'));

  // Scenes carry the POV, which is what makes the POV tracker work against this data.
  const byOrder = new Map<number, string>();
  for (const row of insertedChapters ?? []) byOrder.set(row.order as number, row.id as string);

  const sceneRows = fixture.chapters.flatMap((c) => {
    const chapterId = byOrder.get(c.number);
    if (!chapterId) return [];
    return c.scenes.map((s) => ({
      user_id: userId,
      project_id: project.id,
      chapter_id: chapterId,
      order: s.order,
      title: s.title,
      status: 'drafted',
      summary: s.summary,
      pov: s.pov,
    }));
  });

  if (sceneRows.length > 0) {
    const { error: sceneError } = await supabase.from('scenes').insert(sceneRows);
    // A scene failure is not fatal: the chapters and their prose are the substance, and the
    // import is more useful landing partial than not at all.
    if (sceneError) {
      return finish({ projectId: project.id, projectName, error: `Scenes: ${sceneError.message}` });
    }
  }

  const documentRows = fixture.documents.map((d) => ({
    user_id: userId,
    project_id: project.id,
    title: d.title,
    type: d.type,
    content: d.content,
  }));

  const { error: documentError } = await supabase.from('documents').insert(documentRows);
  if (documentError) {
    return finish({ projectId: project.id, projectName, error: `Documents: ${documentError.message}` });
  }
  fixture.documents.forEach(() => tick('Documents'));

  // The character graph, seeded from the bible's own cast and relationships. This is what
  // makes the graph testable without an API key: extraction is the normal way in, but it
  // costs money, and a graph that can only be filled by paying is a graph that cannot be
  // tried.
  const characterRows = fixture.characters.map((c) => ({
    user_id: userId,
    project_id: project.id,
    node_type: 'character',
    label: c.label,
    properties: { aliases: c.aliases, pov_eligible: true, factions: [] },
    source: 'manual',
    needs_review: false,
  }));

  const { data: insertedCharacters, error: characterError } = await supabase
    .from('graph_nodes')
    .insert(characterRows)
    .select('id, label');
  if (characterError) {
    return finish({ projectId: project.id, projectName, error: `Characters: ${characterError.message}` });
  }

  const idByLabel = new Map<string, string>();
  for (const row of insertedCharacters ?? []) idByLabel.set(row.label as string, row.id as string);
  const idByKey = new Map<string, string>();
  for (const c of fixture.characters) {
    const id = idByLabel.get(c.label);
    if (id) idByKey.set(c.key, id);
  }

  // Event nodes, one per chapter. Relationships that happen at a specific moment hang off
  // these; without them, two different interactions between the same pair collide on the
  // unscoped unique key and the whole insert is rejected -- which is exactly what happened
  // the first time, leaving a graph with every character and no relationships at all.
  const eventRows = fixture.chapters.map((c) => ({
    user_id: userId,
    project_id: project.id,
    node_type: 'event',
    label: c.title,
    properties: {
      chapter_id: byOrder.get(c.number) ?? null,
      scene_id: null,
      book: 0,
      act: c.act,
      // Chapter number, so a character's progression sorts into story order rather than
      // whatever order the rows came back in.
      order: c.number,
      // Resolved through the alias map, because the prose says "Sunny" where the character
      // record says "Dr. Sunny Joseph".
      pov_character_id: idByKey.get(c.pov.toLowerCase()) ?? null,
      // What the chapter is for, and what it closes on -- shown when the event is expanded
      // in Progression.
      summary: c.summary,
      ends_on: c.endsOn,
      pov: c.pov,
    },
    source: 'manual',
    needs_review: false,
  }));

  const { data: insertedEvents, error: eventError } = await supabase
    .from('graph_nodes')
    .insert(eventRows)
    .select('id, properties');
  if (eventError) {
    return finish({ projectId: project.id, projectName, error: `Events: ${eventError.message}` });
  }

  // Mapped back by chapter id rather than by title -- two chapters are allowed to share a
  // title, and matching on one would silently attach edges to the wrong moment.
  const eventByChapterId = new Map<string, string>();
  for (const row of insertedEvents ?? []) {
    const chapterId = (row.properties as { chapter_id?: string } | null)?.chapter_id;
    if (chapterId) eventByChapterId.set(chapterId, row.id as string);
  }
  const eventByChapter = new Map<number, string>();
  for (const c of fixture.chapters) {
    const chapterId = byOrder.get(c.number);
    const eventId = chapterId ? eventByChapterId.get(chapterId) : undefined;
    if (eventId) eventByChapter.set(c.number, eventId);
  }

  const edgeRows = fixture.graphEdges
    .map((e) => {
      const from = idByKey.get(e.from);
      const to = idByKey.get(e.to);
      if (!from || !to) return null;
      return {
        user_id: userId,
        project_id: project.id,
        from_node_id: from,
        to_node_id: to,
        edge_type: 'INTERACTS_WITH',
        // Null for a relationship that holds across the book; an event for one that happens
        // at an identifiable moment.
        event_id: e.chapter === null ? null : eventByChapter.get(e.chapter) ?? null,
        properties: {
          interaction_type: e.interactionType,
          valence: e.valence,
          description: e.description,
        },
        confidence: e.confidence,
        // The ones the fixture marks uncertain arrive needing review, so the review queue
        // has real work in it rather than being an empty screen.
        needs_review: e.confidence !== null,
        source: 'manual',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (edgeRows.length > 0) {
    const { error: edgeError } = await supabase.from('graph_edges').insert(edgeRows);
    if (edgeError) {
      return finish({ projectId: project.id, projectName, error: `Relationships: ${edgeError.message}` });
    }
  }

  // PRESENT_AT: who appears in which chapter. This is the progression layer — without it a
  // character has relationships but no arc, and the web can only answer "who knows whom".
  //
  // Derived rather than authored: a character is present in a chapter if they hold its POV,
  // or if one of their relationships is scoped to it. That understates the truth (people
  // appear in scenes they neither narrate nor interact in) but never invents a presence,
  // which is the right way to be wrong here.
  const presence = new Map<string, Set<string>>();
  const addPresence = (chapter: number, characterId: string | undefined) => {
    if (!characterId) return;
    const eventId = eventByChapter.get(chapter);
    if (!eventId) return;
    if (!presence.has(eventId)) presence.set(eventId, new Set());
    presence.get(eventId)!.add(characterId);
  };

  for (const c of fixture.chapters) addPresence(c.number, idByKey.get(c.pov.toLowerCase()));
  for (const e of fixture.graphEdges) {
    if (e.chapter === null) continue;
    addPresence(e.chapter, idByKey.get(e.from));
    addPresence(e.chapter, idByKey.get(e.to));
  }

  const presenceRows = [...presence.entries()].flatMap(([eventId, characterIds]) =>
    [...characterIds].map((characterId) => ({
      user_id: userId,
      project_id: project.id,
      from_node_id: characterId,
      to_node_id: eventId,
      edge_type: 'PRESENT_AT',
      event_id: eventId,
      properties: {},
      confidence: null,
      needs_review: false,
      source: 'manual',
    })),
  );

  if (presenceRows.length > 0) {
    const { error: presenceError } = await supabase.from('graph_edges').insert(presenceRows);
    if (presenceError) {
      return finish({ projectId: project.id, projectName, error: `Presence: ${presenceError.message}` });
    }
  }
  tick('Character graph');

  return finish({ projectId: project.id, projectName, error: null });
}

export function demoSummary() {
  const f = DEMO_FIXTURE;
  const scenes = f.chapters.reduce((n, c) => n + c.scenes.length, 0);
  const words = f.chapters.reduce((n, c) => n + c.content.split(/\s+/).length, 0);
  const povs = [...new Set(f.chapters.map((c) => c.pov).filter(Boolean))];
  const plants = f.chapters.reduce(
    (n, c) => n + c.annotations.filter((a) => a.type === 'plant').length,
    0,
  );
  const reveals = f.chapters.reduce(
    (n, c) => n + c.annotations.filter((a) => a.type === 'reveal').length,
    0,
  );
  return {
    chapters: f.chapters.length,
    scenes,
    documents: f.documents.length,
    words,
    povs,
    characters: f.characters.length,
    relationships: f.graphEdges.length,
    plants,
    reveals,
    pairs: f.plantRevealPairs.length,
    unpaidPlants: f.plantRevealPairs.filter((p) => p.reveals === 0).length,
  };
}
