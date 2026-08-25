// Answers the two blocking questions against the REAL project, not the demo pack:
//
//   1. Which model of paid/open is actually in use -- pairs groupings, or linkedPlant --
//      how far each has spread, and whether they ever disagree about the same plant.
//   2. Whether a pair grouping is at the granularity of a subplot or of a single setup,
//      which is what the demo pack's 27 groupings at peak concurrency 21 calls into doubt.
//
// It reads. It writes nothing.
//
// Run:
//   SUPABASE_ACCESS_TOKEN=<token> node scripts/report-real-graph-stats.mjs [projectId]
//
// The token is a signed-in session's access token, because every table here is behind RLS
// and the anon key sees an empty array for all of them. Get it from the PWA's DevTools
// console, where the client is exposed as window.sbClient (NOT `supabase` -- that global is
// the library, not the client):
//
//   (await sbClient.auth.getSession()).data.session.access_token
//
// It expires in about an hour and refreshes on its own in the browser, so if this script
// starts returning 401 the token has simply aged out -- read a fresh one the same way.
//
// Paste it only into your own terminal. Not into a chat, not into a file, not into git.
// No password is needed anywhere in this flow.
import { computeSpine, allocateLanes } from '../graph/spine-layout.mjs';

const URL = 'https://lqjhxogravonkfpmtxtm.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxamh4b2dyYXZvbmtmcG10eHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MTEyODUsImV4cCI6MjEwMTQ4NzI4NX0.i3DVWh2PGWidBKD7IzJP6qRBabcwl9eASsLlbGQ6QRs';

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN to a signed-in session token. See the header of this file.');
  process.exit(2);
}

const headers = { apikey: ANON, Authorization: 'Bearer ' + token };

async function rest(pathAndQuery) {
  const res = await fetch(URL + '/rest/v1/' + pathAndQuery, { headers });
  if (!res.ok) throw new Error(pathAndQuery + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}
async function rpc(name, body) {
  const res = await fetch(URL + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(name + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

// projects.name, not .title -- chapters carry a title, projects carry a name, and the two
// tables do not agree with each other. Verified against the live schema, not assumed.
const projects = await rest('projects?select=id,name&order=created_at');
if (!projects.length) { console.error('No projects visible to this session.'); process.exit(1); }

const wanted = process.argv[2];
const targets = wanted ? projects.filter((p) => p.id === wanted) : projects;
console.log('\n' + projects.length + ' project(s) visible; reporting on ' + targets.length + '.\n');

const median = (xs) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

for (const project of targets) {
  console.log('='.repeat(72));
  console.log(project.name + '   (' + project.id + ')');
  console.log('='.repeat(72));

  const chapters = await rest(
    'chapters?select=id,book,act,order,title,status,annotations&project_id=eq.' + project.id);
  const flags = [];
  chapters.forEach((c) => {
    (c.annotations || []).forEach((a) => {
      flags.push({ ...a, chapterId: c.id, chapterTitle: c.title, seq: c.order });
    });
  });

  const plants = flags.filter((f) => f.type === 'plant');
  const reveals = flags.filter((f) => f.type === 'reveal');
  const notes = flags.filter((f) => f.type === 'note');
  const highlights = flags.filter((f) => f.type === 'highlight');

  // ---- fork 1: which model is actually in use -------------------------------------
  const withPairs = flags.filter((f) => f.pairs && f.pairs.length);
  const withLegacyPairId = flags.filter((f) => !f.pairs && f.pairId);
  const revealsWithLink = reveals.filter((f) => f.linkedPlant);
  const linkedTargets = new Set(revealsWithLink.map((f) => f.linkedPlant.annotationId));

  const groupsWithReveal = new Set();
  flags.forEach((f) => {
    if (f.type !== 'reveal') return;
    ((f.pairs && f.pairs.length) ? f.pairs : (f.pairId ? [{ id: f.pairId }] : []))
      .forEach((m) => groupsWithReveal.add(m.id));
  });
  const openByGroupings = plants.filter((p) => {
    const ms = (p.pairs && p.pairs.length) ? p.pairs : (p.pairId ? [{ id: p.pairId }] : []);
    return !ms.some((m) => groupsWithReveal.has(m.id));
  });
  const openByHardLink = plants.filter((p) => !linkedTargets.has(p.id));

  // The only plants where the two models can actually be compared: those carrying both.
  const haveBoth = plants.filter(
    (p) => ((p.pairs && p.pairs.length) || p.pairId) && linkedTargets.has(p.id));
  const disagree = plants.filter((p) => {
    const ms = (p.pairs && p.pairs.length) ? p.pairs : (p.pairId ? [{ id: p.pairId }] : []);
    if (!ms.length) return false;
    const byGroup = !ms.some((m) => groupsWithReveal.has(m.id));
    const byLink = !linkedTargets.has(p.id);
    return byGroup !== byLink;
  });

  console.log('\nPAID/OPEN — which model is in use');
  console.log('  annotations               : ' + flags.length +
    '  (' + plants.length + ' plant, ' + reveals.length + ' reveal, ' +
    notes.length + ' note, ' + highlights.length + ' highlight)');
  console.log('  carrying pairs[]          : ' + withPairs.length);
  console.log('  carrying legacy pairId    : ' + withLegacyPairId.length);
  console.log('  reveals with linkedPlant  : ' + revealsWithLink.length + ' of ' + reveals.length);
  console.log('  plants carrying BOTH      : ' + haveBoth.length + '   <- the only comparable set');
  console.log('  open by groupings         : ' + openByGroupings.length + ' of ' + plants.length);
  console.log('  open by hard link/Ledger  : ' + openByHardLink.length + ' of ' + plants.length);
  console.log('  disagree on the same plant: ' + disagree.length);
  disagree.slice(0, 5).forEach((p) => {
    console.log('      "' + String(p.text || '').slice(0, 48) + '"  in ' + p.chapterTitle);
  });

  console.log('\n  BACKFILL COST');
  console.log('    pairs -> linkedPlant : ' + withPairs.filter((f) => f.type === 'plant').length +
    ' plants would need a reveal chosen for each; a grouping with several reveals has no');
  console.log('      single answer, so any grouping with >1 reveal is a manual decision.');
  const multiReveal = {};
  flags.forEach((f) => {
    if (f.type !== 'reveal') return;
    ((f.pairs && f.pairs.length) ? f.pairs : []).forEach((m) => {
      multiReveal[m.id] = (multiReveal[m.id] || 0) + 1;
    });
  });
  const ambiguous = Object.values(multiReveal).filter((n) => n > 1).length;
  console.log('      groupings with more than one reveal: ' + ambiguous + ' (lossy in this direction)');
  console.log('    linkedPlant -> pairs : ' + revealsWithLink.length +
    ' links become one-element groupings; lossless and scriptable.');

  // ---- fork 2: is a grouping a subplot? -------------------------------------------
  let graph = null;
  try {
    graph = await rpc('character_graph', { p_project_id: project.id });
  } catch (e) {
    console.log('\n  character_graph() unavailable: ' + e.message);
  }

  const payload = graph
    ? { ...graph, chapters: graph.chapters || [], flags: graph.flags || [], scenes: graph.scenes || [] }
    : {
        chapters: chapters.map((c) => ({
          id: c.id, title: c.title, book: c.book, act: c.act, seq: c.order,
          status: c.status, words: 0, eventId: null,
        })),
        scenes: [], flags, events: [], presence: [], nodes: [],
      };

  const spine = computeSpine(payload);
  const N = spine.axis.slots;
  const spans = spine.ribbons.map((r) => r.end - r.start);
  let peak = 0, peakAt = 0;
  for (let o = 1; o <= N; o++) {
    const n = spine.ribbons.filter((r) => r.start <= o && r.end >= o).length;
    if (n > peak) { peak = n; peakAt = o; }
  }
  const closedOnly = allocateLanes(
    spine.ribbons.map((r) => ({ id: r.id, start: r.start, end: r.open ? r.start : r.end })));

  console.log('\nGRANULARITY — is a grouping a subplot, or one setup?');
  console.log('  chapters                  : ' + N + ' across ' + spine.axis.books.length + ' book(s)');
  console.log('  groupings (would-be ribbons): ' + spine.ribbons.length);
  console.log('  peak concurrency          : ' + peak + ' at chapter ' + peakAt);
  console.log('  median span               : ' + median(spans) + ' chapters');
  console.log('  lanes needed              : ' + spine.laneCounts.ribbon +
    '  (' + closedOnly.count + ' if open ones did not run to the end)');
  console.log('  angular ceiling at rest   : ' + spine.ceiling.readable +
    ' concurrent before neighbours are closer than ' + spine.ceiling.minSeparationPx + 'px');
  console.log('  verdict input             : ' +
    (peak > spine.ceiling.readable
      ? 'PEAK EXCEEDS THE CEILING — wrapping does not rescue this granularity'
      : peak > spine.ceiling.readable / 2
        ? 'peak is within one doubling of the ceiling — little headroom'
        : 'peak is comfortably under the ceiling'));

  console.log('\n  DEMO PACK, for comparison: 27 groupings, peak 21, median span 7, 17 chapters.');
}

console.log('\nRead-only. Nothing was written.\n');
