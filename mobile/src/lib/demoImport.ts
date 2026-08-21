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
): Promise<{ projectId: string | null; projectName: string; error: string | null }> {
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
        // Saga-level relationships, not scoped to one scene -- which is exactly the case
        // the unscoped unique index exists for.
        event_id: null,
        properties: { interaction_type: e.interactionType, valence: e.valence },
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
  tick('Character graph');

  return { projectId: project.id, projectName, error: null };
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
