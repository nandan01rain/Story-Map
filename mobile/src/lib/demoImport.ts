import { DEMO_FIXTURE } from './demoFixture';
import { supabase } from './supabase';

// Loads the demo pack into a brand-new project.
//
// This runs in the app rather than from a script on the developer's machine because every
// table is behind row-level security: rows are written with the signed-in user's id and
// readable only by them. A script holding the anon key has no session, so its inserts are
// rejected — correctly. The app already has the session.
//
// Not idempotent by design: each run creates a separate project, so the demo can be loaded,
// wrecked while testing, and loaded again without any cleanup step.

export type ImportProgress = { step: string; done: number; total: number };

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

  // Every reload used to leave another demo project behind. Older ones are removed once the
  // new one exists, so a failed import never destroys the only working copy -- and only
  // projects whose name matches the demo's own prefix are touched, never real work.
  const { data: existingDemos } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', userId)
    .like('name', `${fixture.projectName}%`);

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ user_id: userId, name: projectName, project_type: 'writing' })
    .select()
    .single();
  if (projectError || !project) {
    return { projectId: null, projectName, error: projectError?.message ?? 'Could not create the project.' };
  }
  tick('Project created');

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
    annotations: [],
    versions: [],
  }));

  const { data: insertedChapters, error: chapterError } = await supabase
    .from('chapters')
    .insert(chapterRows)
    .select('id, "order"');
  if (chapterError) {
    // Leave the project behind rather than deleting it: a half-imported project the writer
    // can inspect and delete is more useful than a silent rollback that hides what failed.
    return { projectId: project.id, projectName, error: `Chapters: ${chapterError.message}` };
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
      return { projectId: project.id, projectName, error: `Scenes: ${sceneError.message}` };
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
    return { projectId: project.id, projectName, error: `Documents: ${documentError.message}` };
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
    return { projectId: project.id, projectName, error: `Characters: ${characterError.message}` };
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
    return { projectId: project.id, projectName, error: `Events: ${eventError.message}` };
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
      return { projectId: project.id, projectName, error: `Relationships: ${edgeError.message}` };
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
      return { projectId: project.id, projectName, error: `Presence: ${presenceError.message}` };
    }
  }
  tick('Character graph');

  // Deleted last, after everything above has succeeded. Chapters, scenes, documents and
  // graph rows cascade with the project.
  const stale = (existingDemos ?? []).filter((row) => row.id !== project.id);
  let removed = 0;
  if (stale.length > 0) {
    const { error: cleanupError } = await supabase
      .from('projects')
      .delete()
      .in('id', stale.map((row) => row.id));
    // Not fatal: the new demo is already complete, and leaving old copies behind is a
    // tidiness problem rather than a broken import.
    if (!cleanupError) removed = stale.length;
  }

  return { projectId: project.id, projectName, removed, error: null };
}

export function demoSummary() {
  const f = DEMO_FIXTURE;
  const scenes = f.chapters.reduce((n, c) => n + c.scenes.length, 0);
  const words = f.chapters.reduce((n, c) => n + c.content.split(/\s+/).length, 0);
  const povs = [...new Set(f.chapters.map((c) => c.pov).filter(Boolean))];
  return {
    chapters: f.chapters.length,
    scenes,
    documents: f.documents.length,
    words,
    povs,
    characters: f.characters.length,
    relationships: f.graphEdges.length,
  };
}
