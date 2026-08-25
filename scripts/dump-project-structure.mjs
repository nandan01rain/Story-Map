// Dumps one project's STRUCTURE to a local file, so the spine can be exercised against
// real material instead of the demo fixture.
//
// Run:
//   $env:SUPABASE_ACCESS_TOKEN='...'
//   node scripts/dump-project-structure.mjs 5b520c6d-eca1-4a13-9b3b-3d685a4bae76
//
// Writes graph/.local-project.json, which is gitignored. It is your manuscript's shape:
// chapter titles, act and book numbers, scene titles and summaries, and whatever
// annotations exist. THE PROSE IS NOT INCLUDED -- content is never selected, only its
// length, because the spine needs word counts and nothing else. Keep the file local
// anyway; chapter titles are still your book.
//
// Reads. Writes nothing to the database.
import fs from 'node:fs';
import path from 'node:path';

const URL = 'https://lqjhxogravonkfpmtxtm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxamh4b2dyYXZvbmtmcG10eHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTEyODUsImV4cCI6MjEwMTQ4NzI4NX0.i3DVWh2PGWidBKD7IzJP6qRBabcwl9eASsLlbGQ6QRs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.argv[2];
if (!token) { console.error('Set SUPABASE_ACCESS_TOKEN first.'); process.exit(2); }
if (!projectId) { console.error('Pass a project id. See report-real-graph-stats.mjs for the list.'); process.exit(2); }

const headers = { apikey: ANON, Authorization: 'Bearer ' + token };
async function rest(q) {
  const res = await fetch(URL + '/rest/v1/' + q, { headers });
  if (!res.ok) throw new Error(q.split('?')[0] + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}
async function rpc(name, body) {
  const res = await fetch(URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(name + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

const [project] = await rest('projects?select=id,name&id=eq.' + projectId);
if (!project) { console.error('No project with that id is visible to this session.'); process.exit(1); }

// character_graph() is the same source the app's own web reads, so preferring it keeps this
// honest: what the spine is handed here is what the renderer would be handed.
let payload = null;
try {
  payload = await rpc('character_graph', { p_project_id: projectId });
} catch (e) {
  console.error('character_graph() unavailable (' + e.message + '); falling back to tables.');
}

if (!payload || !payload.chapters || !payload.chapters.length) {
  const chapters = await rest(
    'chapters?select=id,book,act,order,title,status,annotations&project_id=eq.' + projectId);
  const scenes = await rest(
    'scenes?select=id,chapter_id,order,title,summary,pov,status&project_id=eq.' + projectId);
  const flags = [];
  chapters.forEach((c) => (c.annotations || []).forEach((a) => {
    flags.push({ ...a, chapterId: c.id, chapterTitle: c.title, seq: c.order, eventId: null });
  }));
  payload = {
    nodes: [], links: [], events: [], presence: [], interactions: [],
    chapters: chapters.map((c) => ({
      id: c.id, title: c.title, book: c.book, act: c.act, seq: c.order,
      status: c.status, words: 0, eventId: null,
    })),
    scenes: scenes.map((s) => ({
      id: s.id, chapterId: s.chapter_id, seq: s.order, title: s.title,
      summary: s.summary, pov: s.pov, status: s.status,
    })),
    flags,
  };
}

// Belt and braces: if a future character_graph() ever starts returning prose, it does not
// reach the file. The spine has never needed it.
(payload.chapters || []).forEach((c) => { delete c.content; });

const OUT = path.join(process.cwd(), 'graph', '.local-project.json');
fs.writeFileSync(OUT, JSON.stringify({ project, payload }, null, 1), 'utf8');

console.log('\nwrote graph/.local-project.json  (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
console.log('  project  : ' + project.name);
console.log('  chapters : ' + (payload.chapters || []).length);
console.log('  scenes   : ' + (payload.scenes || []).length);
console.log('  flags    : ' + (payload.flags || []).length);
console.log('  events   : ' + (payload.events || []).length);
console.log('\nGitignored. No prose included.\n');
