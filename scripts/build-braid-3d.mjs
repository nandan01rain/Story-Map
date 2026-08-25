// The braid, in three dimensions and interactive.
//
//   graph/braid-3d.html         (demo pack)
//   graph/.local-braid-3d.html  (--local, from graph/.local-project.json)
//
// Run: node scripts/build-braid-3d.mjs [--local]
//
// Geometry comes from graph/spine-layout.mjs, inlined -- exactly as the flat prototype
// does. This file adds a camera, materials and panels; it computes no positions of its own
// beyond turning (ordinal, lane, angle) into a point in space.
//
// TWO DEVIATIONS FROM THE MOCKUP, both deliberate:
//
//   Z is NOT free. The mockup labels it "free (relationships & resonance)", which means
//   simulation output -- a different picture every run, which is the single thing the spine
//   exists to prevent. Here Z is the wrap angle from the same interval packing that gives Y,
//   so the braid is deterministic and Flatten is a projection of it rather than a second
//   layout.
//
//   The camera cannot roll or tumble. It orbits about the X axis and pans along it. X keeps
//   a fixed screen direction because it encodes reading order, and an axis that can be
//   pointed at the viewer can be collapsed to a dot.
//
// three.js is ESM-only since r160 and there is no UMD build (see handoff 17.4). It is
// imported as a module from a CDN; with no network the page says so instead of failing
// blank.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEMO = path.join(ROOT, 'graph', 'character-web-demo.html');
const LAYOUT = path.join(ROOT, 'graph', 'spine-layout.mjs');
const LOCAL = path.join(ROOT, 'graph', '.local-project.json');

// Three outputs from one renderer:
//   (default)  graph/braid-3d.html         demo pack baked in, for looking at
//   --local    graph/.local-braid-3d.html  a real project baked in, gitignored
//   --embed    braid.html + mobile/src/lib/braidHtml.ts, NO data -- the host posts it,
//              which is how both apps consume it
const useLocal = process.argv.includes('--local');
const useEmbed = process.argv.includes('--embed');
const OUT = useEmbed
  ? path.join(ROOT, 'braid.html')
  : path.join(ROOT, 'graph', useLocal ? '.local-braid-3d.html' : 'braid-3d.html');
const OUT_TS = path.join(ROOT, 'mobile', 'src', 'lib', 'braidHtml.ts');

let payload, sourceName;
if (useEmbed) {
  payload = null;
  sourceName = '';
} else if (useLocal) {
  if (!fs.existsSync(LOCAL)) {
    throw new Error('graph/.local-project.json is missing. Run: node scripts/dump-project-structure.mjs <projectId>');
  }
  const dump = JSON.parse(fs.readFileSync(LOCAL, 'utf8'));
  payload = dump.payload;
  sourceName = dump.project.name;
} else {
  const demo = fs.readFileSync(DEMO, 'utf8');
  const at = demo.indexOf('window.__GRAPH__ = ');
  if (at === -1) throw new Error('Run: node scripts/build-graph-demo.mjs');
  const open = demo.indexOf('{', at);
  payload = JSON.parse(demo.slice(open, demo.indexOf('};', open) + 1));
  sourceName = 'The Southern Wing (demo pack)';
}
if (payload) for (const k of ['chapters', 'scenes', 'flags', 'events']) payload[k] = payload[k] || [];

const layout = fs.readFileSync(LAYOUT, 'utf8')
  .replace(/^export (const|function) /gm, '$1 ')
  .replace(/^export \{[^}]*\};?$/gm, '');
if (/\bexport\b/.test(layout)) throw new Error('spine-layout.mjs has an export the inliner missed.');

const HTML = String.raw`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>StoryMap — the braid</title>
<style>
  /* A loom, not an instrument panel. The ground is a deep warm dark rather than neutral
     black: black plus saturated line is the trading-terminal signature, and this app
     already has a material language (the painted map, the Margin's parchment) that the
     braid was the only surface ignoring. */
  :root {
    --ground: #03060d;
    --ink: #f0c464;
    --quiet: #a8813a;
    --rule: rgba(242,185,60,0.18);
    --accent: #f2b93c;
    --book: Georgia, "Iowan Old Style", Palatino, "Palatino Linotype", serif;
    --ui: -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: var(--ground);
    font: 12px/1.5 var(--ui); color: var(--ink); }
  canvas { display: block; }
  #stage { position: fixed; inset: 0; }

  /* Marginalia, not a control room: no panel borders, no fills, no switches. */
  .panel { position: fixed; background: none; border: 0; padding: 0; }
  .panel h3 { margin: 0 0 6px; font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--quiet); font-weight: 600; }

  /* One thin bar. Everything that was a floating panel is a dropdown inside it, so the
     braid gets the screen and the controls get a single line of it. */
  #bar { position: fixed; top: 0; left: 0; right: 0; height: 40px; display: flex;
    align-items: center; gap: 18px; padding: 0 18px; z-index: 5;
    background: linear-gradient(var(--ground), rgba(3,6,13,0)); }
  #brand { font-family: var(--book); font-size: 15px; letter-spacing: .03em; white-space: nowrap; }
  #brand b { font-weight: 400; }
  #brand span { color: var(--quiet); font-family: var(--ui); font-size: 10.5px; margin-left: 10px; }
  #bar nav { margin-left: auto; display: flex; gap: 16px; }

  .dd { position: relative; }
  .dd > summary { list-style: none; cursor: pointer; color: var(--quiet); font-size: 12px;
    padding: 4px 0; white-space: nowrap; }
  .dd > summary::-webkit-details-marker { display: none; }
  .dd > summary:hover { color: var(--ink); }
  .dd[open] > summary { color: var(--accent); }
  .pop { position: absolute; right: 0; top: 26px; min-width: 168px; padding: 10px 12px;
    background: var(--pop); border: 1px solid var(--rule); border-radius: 4px; }
  .pop.wide { width: 260px; max-height: 46vh; display: flex; flex-direction: column; }
  .row { padding: 3px 0; cursor: pointer; font-size: 12px; color: var(--quiet); white-space: nowrap; }
  .row:hover { color: var(--ink); }
  .row.on { color: var(--accent); }
  .row.on::before { content: "\00b7 "; }
  .note { color: var(--quiet); font-size: 10.5px; margin-top: 8px; line-height: 1.4; opacity: .75; }
  button { width: auto; background: none; color: var(--quiet); border: 0; padding: 3px 0;
    font: inherit; font-size: 12px; cursor: pointer; display: block; }
  button:hover { color: var(--accent); }
  .toggle { cursor: pointer; padding: 3px 0; color: var(--quiet); font-size: 12px; }
  .toggle:hover { color: var(--ink); }
  .toggle.on { color: var(--accent); }
  .toggle.on::before { content: "\00b7 "; }
  .toggle.dim { opacity: .45; cursor: default; }
  #how ul { margin: 0; padding: 0; list-style: none; }
  #how li { margin: 3px 0; font-size: 11px; color: var(--quiet); }
  #tabs { display: flex; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  #tabs button { display: inline; font-size: 11px; }
  #tabs button.on { color: var(--accent); }
  #ilist { overflow: auto; }
  .item { padding: 2px 0; cursor: pointer; font-size: 11.5px; color: var(--quiet);
    display: flex; justify-content: space-between; gap: 10px; }
  .item:hover { color: var(--ink); }
  .item span { opacity: .55; }

  .panel { position: fixed; background: none; border: 0; padding: 0; }
  #detail { left: 20px; bottom: 20px; width: 300px; display: none; }
  #detail.on { display: block; }
  #detail h2 { margin: 0 0 3px; font-family: var(--book); font-size: 16px; font-weight: 400;
    color: var(--ink); line-height: 1.25; }
  #detail .sub { color: var(--quiet); font-size: 10px; letter-spacing: .1em;
    text-transform: uppercase; margin-bottom: 9px; }
  #detail dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 14px;
    font-size: 12px; }
  #detail dt { color: var(--quiet); }
  #detail dd { margin: 0; }
  #dclose { position: absolute; top: 0; right: 0; font-size: 15px; }

  #scrub { position: fixed; left: 50%; transform: translateX(-50%); bottom: 18px; width: 260px;
    text-align: center; }
  #scrub input { width: 100%; accent-color: #f2b93c; background: none; }
  #scrub .lab { color: var(--quiet); font-size: 10px; margin-top: 1px; }

  #boot { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 40px; color: var(--quiet); font-family: var(--book); }
</style>

<div id="stage"></div>
<div id="boot">loading the braid&hellip;</div>

<div id="bar" hidden>
  <div id="brand"><b>The Braid</b><span id="subtitle"></span></div>
  <nav>
    <details class="dd"><summary>Layers</summary><div class="pop" id="layers">
      <div class="row on" data-layer="structure">Structure</div>
      <div class="row" data-layer="scenes">Scenes</div>
      <div class="row on" data-layer="flags">Plants &amp; Reveals</div>
      <div class="row on" data-layer="ribbons">Subplots</div>
      <div class="row" data-layer="threads">Mythic threads</div>
      <div class="row" data-layer="strands">Characters</div>
    </div></details>

    <details class="dd"><summary>Show</summary><div class="pop" id="filters">
      <div class="row on" data-filter="all">All</div>
      <div class="row" data-filter="plants">Plants</div>
      <div class="row" data-filter="reveals">Reveals</div>
      <div class="row" data-filter="notes">Notes</div>
      <div class="row" data-filter="unpaid">Still open</div>
      <div class="note">Hides threads. The spine stays.</div>
    </div></details>

    <details class="dd"><summary>View</summary><div class="pop" id="controls">
      <div class="toggle" id="flat">Flatten</div>
      <div class="toggle" id="order"><span id="orderLabel">As it happened</span></div>
      <button id="reset">Reset view</button>
      <button id="top">Look along the spine</button>
    </div></details>

    <details class="dd"><summary>Find</summary><div class="pop wide" id="index">
      <div id="tabs"></div><div id="ilist"></div>
    </div></details>

    <details class="dd"><summary>?</summary><div class="pop" id="how">
      <ul>
        <li>left to right is saga order</li>
        <li>subplots below, characters above</li>
        <li>threads weave over and under</li>
        <li>drag to orbit, shift-drag to pan, scroll to zoom</li>
      </ul>
    </div></details>
  </nav>
</div>

<div class="panel" id="detail"><button id="dclose">&times;</button><div id="dbody"></div></div>

<div id="scrub" hidden>
  <input type="range" id="upto" min="1" value="1">
  <div class="lab" id="uptolab"></div>
</div>

<script>/*__PAYLOAD__*/</script>
<script>
/*__LAYOUT__*/
</script>

<script type="module">
let THREE;
try {
  THREE = await import('https://esm.sh/three@0.180.0');
} catch (err) {
  document.getElementById('boot').innerHTML =
    'The braid needs three.js, which is ESM-only and loaded from a CDN.<br>' +
    'No network, so it could not load.<br><br><span style="opacity:.6">' + err.message + '</span>';
  throw err;
}

// The host handshake, identical to the one the character web already uses, because both
// documents are consumed the same two ways: an iframe in the PWA and a WebView on the
// phone. With data baked in (the demo and local builds) this resolves immediately; without
// it, the page says it is listening and waits. Top-level await keeps the rest of the file
// unchanged -- nothing below needs to know the data arrived late.
function postHost(msg) {
  const payload = JSON.stringify(msg);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
  else if (window.parent && window.parent !== window) window.parent.postMessage(payload, '*');
}

function waitForGraph() {
  return new Promise((resolve) => {
    function receive(e) {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (!msg || msg.type !== 'data' || !msg.payload) return;
      window.removeEventListener('message', receive);
      document.removeEventListener('message', receive);
      resolve(msg.payload);
    }
    // Both targets: a WebView delivers to document, a browser to window.
    window.addEventListener('message', receive);
    document.addEventListener('message', receive);
    postHost({ type: 'ready' });
  });
}

const raw = window.__GRAPH__ || await waitForGraph();
// Defaulted key by key rather than only when the payload is missing entirely: a database
// without the newer migrations returns an older shape, and one absent key should cost one
// layer rather than the whole view.
['chapters', 'scenes', 'flags', 'events', 'presence', 'nodes', 'links'].forEach((k) => {
  if (!Array.isArray(raw[k])) raw[k] = [];
});
const spine = computeSpine(raw, {
  order: new URLSearchParams(location.search).get('order') === 'story' ? 'story' : 'read',
});
const axis = spine.axis, N = axis.slots;

// Two palettes: thread lit in the dark, and thread on paper. The semantics are identical in
// both -- madder reveals, weld plants, indigo subplots, verdigris threads, gold structure --
// only the values move, so nothing has to be relearned when the light changes.
//
// Day is NOT the night palette on a pale ground. Additive glow adds light, and adding light
// to white produces nothing at all, so day drops the glow entirely and lets colour and the
// casing do the work. That is also what thread on paper actually looks like: it does not
// glow, it sits there.
const PALETTES = {
  night: {
    ground:  0x03060d,
    chapter: 0xe8b45a, scene: 0xa8926b, event: 0x8b8478,
    plant:   0x74b45f, reveal: 0xc4483c, note: 0xd39a4a,
    thread:  0x3fb3a8, character: 0x6f7ad0,
    spine:   0xf5be48, ribbonOpen: 0x86c46a, ribbon: 0x6f74c4,
    gold:    0xf2b93c,
    ink: '#f0c464', quiet: '#bb8f3c', band: '#f0c464', act: '#bb8f3c',
    books: [0x0c1226, 0x0f1329, 0x0a1327, 0x101228, 0x0c0f20],
    glow: 1, sky: true,
    css: { ground: '#03060d', ink: '#f0c464', quiet: '#a8813a',
           rule: 'rgba(242,185,60,0.18)', accent: '#f2b93c', pop: 'rgba(3,6,13,0.96)' },
  },
  day: {
    // A warm white page rather than a blue-black sky.
    ground:  0xfaf7f0,
    chapter: 0xb8862a, scene: 0x8a7f6a, event: 0x7d7568,
    plant:   0x3f7f34, reveal: 0xa8332a, note: 0x9c6a1f,
    thread:  0x1f7f77, character: 0x3f4a9e,
    spine:   0xb8860b, ribbonOpen: 0x3f7f34, ribbon: 0x4a4fa0,
    gold:    0xa8791f,
    ink: '#2b2318', quiet: '#6f6250', band: '#8a6a2a', act: '#8a7f6a',
    books: [0xefe6d4, 0xeae4d6, 0xe9e6dc, 0xece3d8, 0xefe8d8],
    glow: 0, sky: false,
    css: { ground: '#faf7f0', ink: '#2b2318', quiet: '#6f6250',
           rule: 'rgba(70,58,38,0.18)', accent: '#a8791f', pop: 'rgba(250,247,240,0.97)' },
  },
};

const THEME = (new URLSearchParams(location.search).get('theme') === 'day') ? 'day' : 'night';
const C = PALETTES[THEME];

// The chrome follows the same choice, through the variables the stylesheet already reads.
(function paintChrome() {
  const r = document.documentElement.style;
  r.setProperty('--ground', C.css.ground);
  r.setProperty('--ink', C.css.ink);
  r.setProperty('--quiet', C.css.quiet);
  r.setProperty('--rule', C.css.rule);
  r.setProperty('--accent', C.css.accent);
  r.setProperty('--pop', C.css.pop);
})();

const BOOK_TINT = C.books;

// ---- the coordinate system ------------------------------------------------------
// X is saga order and nothing else touches it. Y is the lane. Z is that same lane wrapped
// onto a circle -- the identical interval packing, so Flatten is a projection.
const SLOT = 26, SPINE_Y = 0, SCENE_Y = -9, FLAG_Y = -17, EVENT_Y = 12;
const RIB_BASE = -40, RIB_GAP = 7, RIB_R = 62;
const STR_BASE = 30, STR_GAP = 6.5, STR_R = 46;
const THR_BASE = -86, THR_GAP = 8, THR_R = 86;

let flatten = 0;                       // 0 = braided, 1 = flat
let upTo = N;
const X = (o) => (o - 1) * SLOT - ((N - 1) * SLOT) / 2;

// Each class keeps its own radius so it can never compete with another for a lane: subplots
// close in, characters above, mythic threads furthest out because they are the longest-range
// thing in the saga and should read as the outermost weave.
const CLASS = {
  ribbon: { base: RIB_BASE, gap: -RIB_GAP, r: RIB_R },
  strand: { base: STR_BASE, gap: STR_GAP, r: STR_R },
  thread: { base: THR_BASE, gap: -THR_GAP, r: THR_R },
};
function place(kind, lane, angle) {
  const c = CLASS[kind] || CLASS.ribbon;
  const flat = c.base + lane * c.gap;
  return {
    y: flat * flatten + c.r * Math.cos(angle) * (1 - flatten),
    z: c.r * Math.sin(angle) * (1 - flatten),
  };
}

// Thread hangs. A subplot sags between its two anchors like a catenary rather than arcing
// symmetrically -- the symmetric arc was the single strongest tell that this came out of a
// plotting library. The sag also does semantic work for free: depth scales with span, so a
// subplot running half the saga visibly carries more slack than one resolved two chapters
// later, and span length becomes readable as weight.
const SAG_K = 1.7;
const COSH_K = Math.cosh(SAG_K);
function catenary(t) {
  return (Math.cosh((t - 0.5) * 2 * SAG_K) - COSH_K) / (1 - COSH_K);   // 0 at ends, 1 at middle
}
function sagDepth(r) {
  const span = Math.max(1, r.end - r.start);
  return 0.5 + 0.5 * Math.min(1, span / Math.max(2, N * 0.6));
}
function ribbonShape(r, t) {
  const d = sagDepth(r);
  // An open subplot has no far anchor to return to, so it falls away and stays fallen.
  if (r.open) return d * Math.sin(Math.min(1, t * 1.7) * Math.PI / 2);
  return d * catenary(t);
}

// A deterministic per-thread weight. Uniform stroke is mechanical; hashed off the id rather
// than randomised so the same thread is the same weight on every run.
function threadWeight(id, base) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  return base * (0.82 + (h % 100) / 100 * 0.4);
}

// Taper toward the terminals. TubeGeometry has one radius, so the ring at each tubular
// segment is scaled about its own centre on the curve. Thread thins where it ends.
function taperTube(geo, curve, tubular, radial, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i <= tubular; i++) {
    const c = curve.getPointAt(Math.min(1, i / tubular));
    const k = fn(i / tubular);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      if (idx >= pos.count) continue;
      pos.setXYZ(idx,
        c.x + (pos.getX(idx) - c.x) * k,
        c.y + (pos.getY(idx) - c.y) * k,
        c.z + (pos.getZ(idx) - c.z) * k);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// The casing: a wider stroke in the ground colour laid under the thread's own. This is what
// makes a crossing read as OVER and UNDER rather than as two traces sharing a pixel -- the
// upper thread carries a sliver of ground with it and visibly interrupts the lower one.
// Opaque, and writing depth, so the z-buffer decides the interlacing per crossing instead
// of a global draw order; transparency was what defeated it before.
// In two dimensions a casing is a wider stroke laid UNDER the thread. In three it cannot
// be: a wider tube surrounds the thinner one and simply hides it -- which is exactly what
// the first attempt did. The 3D equivalent is an inverted hull: the same tube, slightly
// larger, rendered BACK faces only. Back faces are visible only around the silhouette, so
// it reads as a rim of ground colour hugging the thread, and where one thread crosses in
// front of another its rim visibly interrupts the one behind. That is the over-under read,
// and because everything is opaque and writes depth, which thread is on top at any given
// crossing is decided by where the threads actually are rather than by draw order.
function casingMaterial() {
  return new THREE.MeshBasicMaterial({
    color: C.ground, side: THREE.BackSide, transparent: false, depthWrite: true,
  });
}
function threadMaterial(colour) {
  return new THREE.MeshStandardMaterial({
    color: colour, roughness: THEME === 'day' ? 0.85 : 0.62, metalness: 0.0,
    emissive: colour, emissiveIntensity: 0.22 * C.glow, transparent: false, depthWrite: true,
  });
}

// Lit from within, not outlined. Two concentric additive shells at falling opacity give a
// soft falloff; a single shell gives a hard halo, which is the neon reading this is meant
// to avoid. They never write depth, so an opaque thread crossing in front still occludes
// the glow of the one behind and the interlace survives.
//
// GLOW CARRIES MEANING. Intensity is not uniform: it says what state the thread is in, so
// luminance is doing work the data already contains rather than being decoration.
const GLOW = {
  ribbon: 0.075 * C.glow,   // resolved: low and steady
  open:   0.155 * C.glow,   // still open: the brightest thing in its neighbourhood
  thread: 0.045 * C.glow,   // mythic: lowest, because it runs saga-length and would dominate
  spine:  0.115 * C.glow,   // the one constant, and the only structural thing that glows
};
// THE BLEACHING FIX.
//
// Additive blending sums channels. A hue that is already desaturated has substantial values
// in all three channels, so stacking it repeatedly drives every channel toward its ceiling
// and the result trends white -- which is why madder was reading pink-grey and the greens
// read sage. The glow was not adding light to the thread, it was adding whiteness.
//
// So the glow is the thread's own hue pushed UP in saturation and DOWN in value: adding a
// deep, saturated version of the colour adds hue without adding white. The core keeps its
// own colour at full strength and sits on top, so the thread reads as a coloured filament
// lit from within rather than as a pale thread wearing a halo.
function saturated(hex, boost, valueMul) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s + (boost === undefined ? 0.42 : boost)),
    Math.max(0.06, hsl.l * (valueMul === undefined ? 0.62 : valueMul)));
  return c;
}
function glowMaterial(colour, intensity) {
  return new THREE.MeshBasicMaterial({
    color: saturated(colour), transparent: true, opacity: intensity,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
}

// At 21 concurrent subplots the glow accumulates wherever threads bunch and the middle of
// the picture blooms into a wash. So each thread's glow is scaled down by how crowded its
// own stretch of the axis is: the denser the weave, the fainter each strand contributes,
// and the total stays roughly bounded instead of summing.
function localDensity(r, all) {
  const mid = (r.start + r.end) / 2;
  let n = 0;
  all.forEach((o) => { if (o.start <= mid && o.end >= mid) n += 1; });
  return n;
}
function densityScale(n) {
  return Math.max(0.28, Math.min(1, 3.2 / (2.2 + n * 0.42)));
}
function addGlow(group, curve, tubular, radial, weight, colour, intensity, taper) {
  [[1.9, 0.68], [3.1, 0.32]].forEach(([mult, share]) => {
    const g = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, tubular, weight * mult, radial, false),
        curve, tubular, radial, taper),
      glowMaterial(colour, intensity * share));
    g.userData.restOpacity = intensity * share;
    g.renderOrder = 2;
    group.add(g);
    group.userData.glows.push(g);
  });
}
function ribbonPointAt(r, ord) {
  const p = place('ribbon', r.lane, r.angle);
  const end = Math.min(r.end, upTo);
  const span = X(end) - X(r.start);
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, (X(ord) - X(r.start)) / span));
  const k = ribbonShape(r, t);
  return { x: X(ord), y: p.y * k, z: p.z * k };
}

// ---- scene ----------------------------------------------------------------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.ground);
scene.fog = new THREE.Fog(C.ground, 520, 1800);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 1, 4000);
scene.add(new THREE.AmbientLight(THEME === 'day' ? 0xffffff : 0xdfe6f5, THEME === 'day' ? 0.9 : 0.55));
const key = new THREE.DirectionalLight(THEME === 'day' ? 0xfff6e8 : 0xffeed4, THEME === 'day' ? 0.75 : 1.15);
key.position.set(-0.4, 1, 0.8);
scene.add(key);
const rim = new THREE.DirectionalLight(THEME === 'day' ? 0xcfd8e8 : 0x8fa8d8, THEME === 'day' ? 0.25 : 0.42);
rim.position.set(0.6, -0.5, -0.9);
scene.add(rim);

// Text as a canvas texture: labels are drawn, not hovered. A braid of unlabelled shapes
// cannot be navigated, which is the same reason the flat renderer draws its titles.
function label(text, opts) {
  const o = opts || {};
  const size = o.size || 46, pad = 12;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const face = o.book
    ? 'Georgia, "Iowan Old Style", Palatino, serif'
    : 'system-ui, sans-serif';
  g.font = (o.weight || 500) + ' ' + size + 'px ' + face;
  const w = Math.ceil(g.measureText(text).width) + pad * 2;
  c.width = w; c.height = size + pad * 2;
  g.font = (o.weight || 500) + ' ' + size + 'px ' + face;
  g.fillStyle = o.color || C.ink;
  g.textBaseline = 'middle';
  if (o.letter) g.letterSpacing = o.letter;
  g.fillText(text, pad, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: o.opacity == null ? 0.92 : o.opacity,
    depthWrite: false, sizeAttenuation: true,
  }));
  const scale = (o.world || 9) / size;
  sp.scale.set(c.width * scale, c.height * scale, 1);
  return sp;
}

// The sky. Parented to the CAMERA, not to the world, so it cannot parallax when the view
// pans or orbits -- a background that slides against the data reads as depth cueing and
// invites the eye to track it. It is static by construction rather than by restraint.
//
// The hard constraint: nothing here may compete with a data mark. The faintest scene tick
// is a small lit box; these are unlit points at a fifth of its brightness, drawn first and
// never depth-writing, so no star can ever be mistaken for something clickable.
function buildSky() {
  const sky = new THREE.Group();

  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dg = dot.getContext('2d');
  const rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  dg.fillStyle = rg;
  dg.fillRect(0, 0, 32, 32);
  const dotTex = new THREE.CanvasTexture(dot);

  // Low density on purpose: sky, not texture. A seeded generator rather than Math.random,
  // so the same sky comes back on every load -- the whole design turns on the picture being
  // the same twice.
  let seed = 20260825;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const COUNT = 420;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3]     = (rnd() - 0.5) * 2600;
    pos[i * 3 + 1] = (rnd() - 0.5) * 1700;
    pos[i * 3 + 2] = -900 - rnd() * 200;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    // Size in PIXELS, not world units: attenuated points nine hundred units away are
    // sub-pixel and simply do not appear. Fixed size also means the sky does not swell as
    // the camera dollies, which would read as motion.
    map: dotTex, color: 0xc8d6f5, size: 1.7, sizeAttenuation: false,
    transparent: true, opacity: 0.13, depthWrite: false, depthTest: false,
  }));
  // Parented to a moving camera, so its local bounding sphere is meaningless to the
  // frustum test -- without this the whole sky can be culled and simply never appear.
  points.frustumCulled = false;
  points.renderOrder = -10;
  sky.add(points);

  // Two nebular washes, barely there, for depth. Same rule: dimmer than any mark.
  const wash = document.createElement('canvas');
  wash.width = wash.height = 256;
  const wg = wash.getContext('2d');
  const wr = wg.createRadialGradient(128, 128, 0, 128, 128, 128);
  wr.addColorStop(0, 'rgba(120,150,220,0.30)');
  wr.addColorStop(0.5, 'rgba(90,110,190,0.10)');
  wr.addColorStop(1, 'rgba(60,80,150,0)');
  wg.fillStyle = wr;
  wg.fillRect(0, 0, 256, 256);
  const washTex = new THREE.CanvasTexture(wash);
  [[-620, 190, 0.11], [560, -230, 0.08]].forEach(([x, y, o]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: washTex, transparent: true, opacity: o, depthWrite: false, depthTest: false,
    }));
    sp.position.set(x, y, -950);
    sp.scale.set(1500, 1100, 1);
    sp.frustumCulled = false;
    sp.renderOrder = -11;
    sky.add(sp);
  });

  return sky;
}
const sky = buildSky();
sky.visible = C.sky;   // a starfield on a white page is not a sky, it is dirt
camera.add(sky);
scene.add(camera);

const groups = {};
['books', 'structure', 'scenes', 'flags', 'ribbons', 'threads', 'strands'].forEach((k) => {
  groups[k] = new THREE.Group();
  scene.add(groups[k]);
});
const picks = [];                                  // raycastable meshes

// Connectors between the two ends of a pair. Thinner than a subplot tube, because a tube is
// the arc and these are just the correspondence; and drawn ONLY while one end is selected,
// because every pair drawn at once is the smear the labels already taught us to avoid.
// Green leads outward from a plant to what answers it, red outward from a reveal to what
// set it up -- so the colour says which end you are standing on.
const links = new THREE.Group();
scene.add(links);

// ---- book slabs and act dividers -------------------------------------------------
axis.books.forEach((b, i) => {
  const x0 = X(b.from) - SLOT / 2, x1 = X(b.to) + SLOT / 2;
  const w = x1 - x0, h = 150;
  const mat = new THREE.MeshBasicMaterial({
    color: BOOK_TINT[i % BOOK_TINT.length], transparent: true, opacity: 0.11,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  slab.position.set((x0 + x1) / 2, 26, -46);
  groups.books.add(slab);

  const cap = label('BOOK ' + toRoman(b.book + 1), { size: 46, world: 8, color: C.band, weight: 400 });
  cap.position.set((x0 + x1) / 2, 92, -45);
  groups.books.add(cap);

  const edge = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, -50, -46), new THREE.Vector3(x0, 100, -46)]),
    new THREE.LineBasicMaterial({ color: 0xc69a3a, transparent: true, opacity: 0.3 }));
  groups.books.add(edge);
});

axis.acts.forEach((a) => {
  const t = label('Act ' + a.act, { size: 30, world: 4.5, color: C.act, opacity: 0.7 });
  t.position.set((X(a.from) + X(a.to)) / 2, 72, -44);
  groups.books.add(t);
});

function toRoman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  map.forEach(([v, s]) => { while (n >= v) { out += s; n -= v; } });
  return out;
}

// ---- the spine -------------------------------------------------------------------
const spineLine = new THREE.Mesh(
  new THREE.CylinderGeometry(0.62, 0.62, (N - 1) * SLOT, 10),
  threadMaterial(C.spine));
const spineGlow = new THREE.Mesh(
  new THREE.CylinderGeometry(1.9, 1.9, (N - 1) * SLOT, 10),
  glowMaterial(C.spine, GLOW.spine));
spineGlow.rotation.z = Math.PI / 2;
spineGlow.renderOrder = 2;
groups.structure.add(spineGlow);
spineLine.rotation.z = Math.PI / 2;
groups.structure.add(spineLine);

// Status as FINISH, not as a chart. The four states the writer already sets -- idea,
// outline, drafted, final -- are expressed as how worked the material looks: an unworked
// bead is paler and matte, a finished one deeper and polished with a stronger highlight.
// No rings, no badges, no colour coding. Texture first, information second.
const FINISH = {
  idea:    { light: 1.22, rough: 0.96, hi: 0.10, grain: 0.05 },
  outline: { light: 1.10, rough: 0.88, hi: 0.16, grain: 0.07 },
  drafted: { light: 0.94, rough: 0.62, hi: 0.30, grain: 0.10 },
  final:   { light: 0.82, rough: 0.42, hi: 0.42, grain: 0.12 },
};

// Deterministic per-bead variation, seeded off the chapter id. Identical beads read as
// machined; slightly varied ones read as made. Kept small -- hand-turned, not irregular.
function beadSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 0) % 1000) / 1000; };
}

const beadTextures = [];
const texCache = {};

// Detail is gated on how many DEVICE pixels a mark actually occupies, not on camera
// distance. Distance was a proxy for size and a bad one: it ignores field of view, viewport
// size and display density, so the same threshold produced different results on different
// screens. These are the sizes at which detail can be seen at all.
// Both derived, not chosen. The earlier 22 and 70 were guesses made under phone-shaped
// assumptions and the first of them was simply wrong: at 22 device pixels the grain could
// not be resolved at all, which is most of why it read as mud.
//
//   BANDS is the striation count around the whole bead; about half of it faces the viewer,
//   so a bead needs two device pixels per visible band to resolve any of it. 36 bands means
//   18 visible means 36 pixels, and 40 gives a little margin.
//
//   The small texture is 128 wide and wraps the whole bead, so 64 texels face the viewer.
//   Past 64 device pixels it is being magnified, and that is where the large one earns its
//   memory -- not before.
const BEAD_BANDS = 36;
const PX_GRAIN = 40;
const PX_DETAIL = 64;
// Hysteresis, so a bead sitting exactly on a threshold does not flicker between states as
// the camera drifts. The swap is also below the eye's notice by construction: the grain's
// own contrast is about 0.05, so what changes across the boundary is smaller than the
// difference between two adjacent bands.
const PX_HYST = 6;

function beadTexture(chapter, withGrain, big) {
  const f = FINISH[chapter.status] || FINISH.idea;
  const key = chapter.status + '|' + (withGrain ? 'g' : 'p') + '|' + (big ? 'b' : 's');
  if (texCache[key]) return texCache[key];

  const hiPos = 0.42, hiOff = 0.42;

  // u (canvas x) runs ALONG the thread; v (canvas y) runs around the bead.
  const W = big ? 512 : 128, H = big ? 256 : 64;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const base = new THREE.Color(C.chapter).clone();
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  base.setHSL(hsl.h, hsl.s * (chapter.status === 'idea' ? 0.72 : 0.95),
    Math.min(0.86, hsl.l * f.light));
  g.fillStyle = '#' + base.getHexString();
  g.fillRect(0, 0, W, H);

  // Turned banding: rings around the thread, low contrast, same orientation on every bead
  // so they read as one material. Phase varies per bead, spacing does not.
  // Fine striation, not stripes. The first version drew about seven bands across the whole
  // wrap, of which three were ever visible -- which is why it read as painted stripes rather
  // than turned wood. Frequency up by a factor of six, contrast down by about half.
  g.globalAlpha = withGrain ? f.grain * 0.55 : 0;
  const step = Math.max(1, Math.round(W / 256));
  for (let x = 0; x < W; x += step) {
    const t = x / W;
    const v = Math.sin(t * Math.PI * BEAD_BANDS * 2);
    g.fillStyle = v > 0 ? '#000000' : '#ffffff';
    g.globalAlpha = (withGrain ? f.grain * 0.55 : 0) * Math.abs(v);
    g.fillRect(x, 0, step, H);
  }
  g.globalAlpha = 1;

  // Darker at both ends, where the thread enters and leaves. This is what seats the bead on
  // the spine rather than letting it hover.
  const ends = g.createLinearGradient(0, 0, W, 0);
  ends.addColorStop(0, 'rgba(0,0,0,0.55)');
  ends.addColorStop(0.18, 'rgba(0,0,0,0)');
  ends.addColorStop(0.82, 'rgba(0,0,0,0)');
  ends.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = ends;
  g.fillRect(0, 0, W, H);

  // One restrained highlight, offset from centre, its position varying slightly per bead.
  const hg = g.createRadialGradient(W * hiPos, H * hiOff, 0, W * hiPos, H * hiOff, W * 0.22);
  hg.addColorStop(0, 'rgba(255,246,225,' + f.hi + ')');
  hg.addColorStop(1, 'rgba(255,246,225,0)');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  texCache[key] = tex;
  return tex;
}

function beadMaterial(chapter) {
  const f = FINISH[chapter.status] || FINISH.idea;
  // Form -- the round shading, the darkened ends where the thread passes through, the
  // highlight -- is what makes it a bead and belongs at every zoom. Only the banding is
  // detail that should disappear. An earlier version faded the whole map and took the
  // object with it.
  //
  // The image is shared; the per-bead variation is a clone with its own offset, so no two
  // beads show the same phase of grain or sit the highlight in quite the same place, and
  // the memory cost of that variation is zero.
  const rnd = beadSeed(String(chapter.id));
  const phase = rnd();
  const own = (t) => { const c = t.clone(); c.needsUpdate = true; c.offset.x = phase; return c; };

  const variants = {
    grainSmall: own(beadTexture(chapter, true, false)),
    plainSmall: own(beadTexture(chapter, false, false)),
    grainBig: null, plainBig: null, chapter,
  };
  const mat = new THREE.MeshStandardMaterial({
    map: variants.grainSmall, color: 0xffffff, roughness: f.rough, metalness: 0.0,
  });
  variants.mat = mat;
  variants.own = own;
  beadTextures.push(variants);
  return mat;
}

// A title may occupy its own slot and no more. At this world size a character is about
// 0.55 of the type size wide, so the character budget follows from SLOT rather than from a
// number picked by eye.
const TITLE_WORLD = 2.9;
const TITLE_CHARS = Math.max(8, Math.floor((SLOT * 0.98) / (0.55 * TITLE_WORLD)));

// The annotation marks were the last flat-shaded things in a lit image. They get the same
// treatment as a bead -- a form gradient, a darker rim where the mark meets its thread, one
// offset highlight -- with one rule governing how much of it each mark receives:
//
//   DETAIL SCALES WITH SIZE. A bead is large enough to carry striation. A scene tick is six
//   pixels and cannot; forcing grain onto it produces mud, which is worse than flat. Small
//   marks get form and rim only, and no grain at any zoom.
//
// Shapes and colours are untouched -- both are load-bearing for what a mark means, and this
// pass changes surface and nothing else.
const markMaterials = [];
const markTexCache = {};

function markTexture(hex, withGrain, small) {
  const key = hex + (withGrain ? 'g' : 'p') + (small ? 's' : 'l');
  if (markTexCache[key]) return markTexCache[key];

  const W = 128, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const base = new THREE.Color(hex);
  g.fillStyle = '#' + base.getHexString();
  g.fillRect(0, 0, W, H);

  // Form: lit from above, falling away below.
  const form = g.createLinearGradient(0, 0, 0, H);
  form.addColorStop(0, 'rgba(255,250,240,0.20)');
  form.addColorStop(0.45, 'rgba(255,250,240,0)');
  form.addColorStop(1, 'rgba(0,0,0,0.34)');
  g.fillStyle = form;
  g.fillRect(0, 0, W, H);

  // Rim: darker where the mark meets the thread it sits on, so it is seated rather than
  // pasted over. Same reasoning as the bead's darkened ends.
  const rim = g.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, W * 0.55);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = rim;
  g.fillRect(0, 0, W, H);

  // Grain, only on marks big enough to show it.
  if (withGrain && !small) {
    for (let y = 0; y < H; y += 1) {
      const v = Math.sin((y / H) * Math.PI * 52);
      g.globalAlpha = 0.05 * Math.abs(v);
      g.fillStyle = v > 0 ? '#000000' : '#ffffff';
      g.fillRect(0, y, W, 1);
    }
    g.globalAlpha = 1;
  }

  // One restrained highlight, offset from centre.
  const hi = g.createRadialGradient(W * 0.38, H * 0.34, 0, W * 0.38, H * 0.34, W * 0.3);
  hi.addColorStop(0, 'rgba(255,250,236,0.30)');
  hi.addColorStop(1, 'rgba(255,250,236,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8;
  markTexCache[key] = tex;
  return tex;
}

function markMaterial(hex, opts) {
  const o = opts || {};
  const grain = o.small ? null : markTexture(hex, true, false);
  const plain = markTexture(hex, false, !!o.small);
  const mat = new THREE.MeshStandardMaterial({
    map: grain || plain, color: 0xffffff,
    roughness: o.rough === undefined ? 0.6 : o.rough, metalness: 0.0,
  });
  markMaterials.push({ mat, grain, plain });
  return mat;
}

const chapterMesh = {};
const chapterTitles = [];
const chapterNumerals = [];
let grainOn = true;
let detailOn = false;

// Screen size of a world-space radius at the current camera, in CSS pixels.
function markScreenSize(worldRadius) {
  const vFov = (camera.fov * Math.PI) / 180;
  return (worldRadius * 2 / (2 * Math.tan(vFov / 2) * Math.max(1, dist))) * innerHeight;
}
axis.sorted.forEach((c) => {
  const o = axis.ordinal[c.id];
  // A turned bead threaded onto the spine. Silhouette and hit target are exactly as they
  // were; everything here is surface. The geometry is rotated so its poles lie ALONG the
  // thread, which is what lets the texture's banding run as rings around the thread -- the
  // way a bead turned on a lathe actually reads -- and lets the ends darken where the
  // thread enters and leaves, so the bead sits on the spine instead of floating over it.
  const geo = new THREE.SphereGeometry(2.5, 20, 14);
  geo.scale(0.85, 1.35, 1.35);
  geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, beadMaterial(c));
  m.position.set(X(o), SPINE_Y, 0);
  m.userData = { kind: 'chapter', id: c.id, ord: o, data: c };
  groups.structure.add(m);
  picks.push(m);
  chapterMesh[c.id] = m;

  const n = label(String(o), { size: 26, world: 3.4, color: C.quiet, opacity: 0.8 });
  n.position.set(X(o), SPINE_Y - 6.5, 0);
  n.userData = { numeralFor: c.id, ord: o };
  groups.structure.add(n);
  chapterNumerals.push(n);

  // ONE row, one truncation rule. The two staggered rows were a way of fitting more titles
  // in without solving the overlap, and they did not solve it -- they produced two rows that
  // both overlapped, which reads as a rendering fault. A title is now truncated to the width
  // of its own chapter slot and sits on a single line; where even that collides, the
  // collision pass drops it rather than letting two titles share pixels.
  const t = label(clip(c.title, TITLE_CHARS), {
    size: 30, world: TITLE_WORLD, color: C.ink, opacity: 0.95, book: true,
  });
  t.position.set(X(o), SPINE_Y + 9.5, 0);
  t.userData = { titleFor: c.id, ord: o };
  groups.structure.add(t);
  chapterTitles.push(t);
});

function clip(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---- scenes ----------------------------------------------------------------------
const scenesByChapter = {};
raw.scenes.forEach((s) => { (scenesByChapter[s.chapterId] = scenesByChapter[s.chapterId] || []).push(s); });
const sceneX = {};
Object.keys(scenesByChapter).sort().forEach((cid) => {
  const list = scenesByChapter[cid].slice().sort((a, b) => a.seq - b.seq);
  const base = X(axis.ordinal[cid]);
  list.forEach((s, i) => {
    const x = base + ((i + 1) / (list.length + 1) - 0.5) * SLOT * 0.8;
    sceneX[s.id] = x;
    // A scene tick is the smallest mark on the picture. It gets form and rim and nothing
    // else -- no grain at any zoom -- and it is a plate rather than a cube for the same
    // reason the notes are.
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.5),
      markMaterial(C.scene, { small: true, rough: 0.75 }));
    m.position.set(x, SCENE_Y, 0);
    m.userData = { kind: 'scene', id: s.id, ord: axis.ordinal[cid], data: s };
    groups.scenes.add(m);
    picks.push(m);
  });
});

// ---- flags, ON their subplot ------------------------------------------------------
// A plant and the reveal that pays it are joined by the ribbon they share, so the flags are
// placed ON that ribbon rather than in a row beneath the spine. Before this they were drawn
// as loose markers and nothing pointed anywhere: you could see that a line was flagged and
// not where it was answered, which is most of the question.
//
// A flag belonging to several groupings gets a marker on each -- that is not duplication,
// it is the line doing two jobs, which the pairs model exists to express.
//
// A flag in no grouping (every note, and any plant nobody has joined yet) has no ribbon to
// sit on and stays near the spine, which is the honest place for it.
const ribbonById = {};
spine.ribbons.forEach((r) => { ribbonById[r.id] = r; });

const groupsWithReveal = new Set();
raw.flags.forEach((f) => {
  if (f.type !== 'reveal') return;
  (f.pairs || []).forEach((m) => groupsWithReveal.add(m.id));
});
const openIds = new Set(raw.flags.filter((f) => {
  if (f.type !== 'plant') return false;
  const ms = f.pairs || [];
  return !ms.length || !ms.some((m) => groupsWithReveal.has(m.id));
}).map((f) => f.id));

// Who answers whom, so the panel can say it in words as well as draw it.
const counterparts = {};
spine.ribbons.forEach((r) => {
  r.plants.forEach((pid) => {
    counterparts[pid] = (counterparts[pid] || []).concat(
      r.reveals.map((rid) => ({ id: rid, via: r })));
  });
  r.reveals.forEach((rid) => {
    counterparts[rid] = (counterparts[rid] || []).concat(
      r.plants.map((pid) => ({ id: pid, via: r })));
  });
});

const flagById = {};
raw.flags.forEach((f) => { flagById[f.id] = f; });

function flagGeometry(type) {
  // Segment count raised so a cone reads as a cone rather than as a pentagon; the
  // silhouette -- triangle up for a plant, down for a reveal -- is unchanged, which is the
  // part that carries meaning.
  if (type === 'plant' || type === 'reveal') return new THREE.ConeGeometry(2.2, 4.2, 18);
  // A card, not a cube. At this size an extruded box reads as an isometric block pasted
  // onto the picture, which is worse than flat.
  return new THREE.BoxGeometry(3.0, 3.4, 0.22);
}
function flagColor(type, thread) {
  if (type === 'plant') return C.plant;
  if (type === 'reveal') return C.reveal;
  return thread ? C.thread : C.note;
}

const flagMeshes = [];
const spineFlags = {};          // anchor key -> running count, for fanning the loose ones

raw.flags.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).forEach((f) => {
  const ord = axis.ordinal[f.chapterId];
  if (!ord) return;
  const kind = (f.type === 'note' && f.thread) ? 'thread' : f.type;
  const memberships = (f.pairs || []).filter((m) => ribbonById[m.id]);

  const make = (ribbon) => {
    const col = flagColor(f.type, f.thread);
    const m = new THREE.Mesh(flagGeometry(f.type), markMaterial(col, { rough: 0.55 }));
    if (f.type === 'reveal') m.rotation.z = Math.PI;
    m.userData = { kind: kind, id: f.id, ord: ord, data: f, flag: true, ribbon: ribbon || null };
    groups.flags.add(m);
    picks.push(m);
    flagMeshes.push(m);
    return m;
  };

  if (memberships.length) {
    memberships.forEach((mem) => make(ribbonById[mem.id]));
  } else {
    const key = f.chapterId;
    const i = (spineFlags[key] = (spineFlags[key] || 0) + 1) - 1;
    const m = make(null);
    m.position.set(X(ord) + ((i % 4) / 3 - 0.5) * SLOT * 0.7, FLAG_Y - Math.floor(i / 4) * 4.4, 0);
    m.userData.loose = true;
  }
});

// ---- subplot ribbons -------------------------------------------------------------
// One tube per grouping, from its first plant to its last reveal. An open one runs to the
// end of the saga and ends in a cap: a positive mark, not a fade, because a fade at the
// back of the braid is indistinguishable from something merely far away.
const ribbonObjs = [];
spine.ribbons.forEach((r) => {
  const g = new THREE.Group();
  const mat = threadMaterial(r.open ? C.ribbonOpen : C.ribbon);
  const casing = casingMaterial();
  g.userData = { kind: 'ribbon', id: r.id, ord: r.start, data: r, mat: mat, glows: [] };
  groups.ribbons.add(g);
  ribbonObjs.push(g);

  // An open subplot FRAYS rather than ending in a cap: the thread unravels into finer
  // strands that thin to nothing. Still a positive mark -- present at every zoom, and not
  // confusable with something merely occluded -- but said in the material's own language.
  const fray = r.open ? new THREE.Group() : null;
  if (fray) g.add(fray);

  const tag = label(clip(r.label, 22), {
    size: 26, world: 2.6, color: r.open ? '#' + new THREE.Color(C.ribbonOpen).getHexString() : '#' + new THREE.Color(C.ribbon).getHexString(), opacity: 0.9,
  });
  g.add(tag);
  g.userData.fray = fray;
  g.userData.casingMat = casing;
  g.userData.tag = tag;
  g.userData.tube = null;
});

// ---- mythic threads ---------------------------------------------------------------
// The one structure explicitly meant to recur across the whole saga, and until now the one
// with no span drawn at all -- its touches were loose note markers with nothing joining
// them. A thread with two or more touches gets an arc, in its own radius class.
const threadObjs = [];
spine.threads.forEach((t) => {
  const g = new THREE.Group();
  const mat = threadMaterial(C.thread);
  g.userData = { kind: 'thread-arc', id: t.id, ord: t.start, data: t, mat: mat, tube: null, glows: [] };
  const tag = label(clip(t.label, 24), { size: 26, world: 2.6, color: '#' + new THREE.Color(C.thread).getHexString(), opacity: 0.9 });
  g.add(tag);
  g.userData.tag = tag;
  groups.threads.add(g);
  threadObjs.push(g);
});

// ---- character strands -----------------------------------------------------------
// A continuous line across the span with beads where a moment was actually recorded. The
// line asserts the character exists across that stretch; the beads assert only what is
// logged. A gap is an unrecorded stretch, never a claim that anybody left.
const strandObjs = [];
spine.strands.forEach((s) => {
  const g = new THREE.Group();
  g.userData = { kind: 'strand', id: s.id, ord: s.start, data: s };
  groups.strands.add(g);
  strandObjs.push(g);

  s.beads.forEach((b) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(b.isPov ? 1.9 : 1.2, 16, 12),
      markMaterial(C.character, { small: true, rough: 0.55 }));
    m.userData = { bead: true, ord: b.ord };
    g.add(m);
  });
  const tag = label(s.label, { size: 26, world: 2.6, color: '#' + new THREE.Color(C.character).getHexString(), opacity: 0.85 });
  g.add(tag);
  g.userData.tag = tag;
  g.userData.line = null;
});

// ---- rebuild the parts whose geometry depends on flatten / upTo -------------------
function rebuildCurves() {
  ribbonObjs.forEach((g) => {
    const r = g.userData.data;
    if (g.userData.tube) { g.remove(g.userData.tube); g.userData.tube.geometry.dispose(); }
    if (g.userData.cased) { g.remove(g.userData.cased); g.userData.cased.geometry.dispose(); }
    while (g.userData.glows.length) {
      const gl = g.userData.glows.pop();
      g.remove(gl); gl.geometry.dispose(); gl.material.dispose();
    }
    if (r.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const end = Math.min(r.end, upTo);
    const p = place('ribbon', r.lane, r.angle);
    const pts = [];
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = X(r.start) + (X(end) - X(r.start)) * t;
      // Leaves the spine, runs in its lane, and returns to the spine at the reveal --
      // unless it is open, in which case it never comes back.
      const k = ribbonShape(r, t);
      pts.push(new THREE.Vector3(x, p.y * k, p.z * k));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const w = threadWeight(r.id, 0.72);
    const TUB = 64, RAD = 7;

    // Thread, then the casing beneath it. Both tapered toward the ends.
    const taper = (f) => 0.35 + 0.65 * Math.sin(Math.min(1, Math.max(0, f)) * Math.PI);
    const tube = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, TUB, w, RAD, false), curve, TUB, RAD, taper),
      g.userData.mat);
    const cased = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(curve, TUB, w * 2.1, RAD, false), curve, TUB, RAD, taper),
      g.userData.casingMat);
    // renderOrder keeps the casing painted immediately before its own thread; depth does
    // the rest, so which of two crossing threads is on top is decided by where they
    // actually are rather than by the order they happen to be in the scene.
    tube.userData = g.userData;
    cased.userData = g.userData;
    g.add(cased);
    g.add(tube);
    g.userData.tube = tube;
    g.userData.cased = cased;

    const dens = densityScale(localDensity(r, spine.ribbons));
    const base = (r.open ? GLOW.open : GLOW.ribbon) * dens;
    addGlow(g, curve, TUB, RAD, w, r.open ? C.ribbonOpen : C.ribbon, base, taper);

    // An open subplot brightens toward the frayed end, so the unfinished thing is the
    // brightest thing near it. Done as a second glow over the last stretch of the curve
    // rather than by varying opacity along one tube, which a single material cannot do.
    if (r.open) {
      const tail = new THREE.CatmullRomCurve3(pts.slice(Math.floor(pts.length * 0.62)));
      addGlow(g, tail, 20, RAD, w, C.ribbonOpen, base * 0.85, (f) => 0.45 + 0.55 * f);
    }

    if (g.userData.fray) {
      while (g.userData.fray.children.length) {
        const c = g.userData.fray.children.pop();
        c.geometry.dispose();
      }
      const tip = pts[pts.length - 1];
      const prev = pts[pts.length - 2] || tip;
      const dir = tip.clone().sub(prev).normalize();
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.55;
        const a = tip.clone();
        const b = tip.clone().add(dir.clone().multiplyScalar(SLOT * 0.55))
          .add(new THREE.Vector3(0, spread * 2.4, spread * 1.6));
        const fc = new THREE.CatmullRomCurve3([
          a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, spread * 0.9, 0)), b]);
        const fg = taperTube(new THREE.TubeGeometry(fc, 18, w * 0.5, 5, false), fc, 18, 5,
          (f) => 1 - f * 0.95);
        g.userData.fray.add(new THREE.Mesh(fg, g.userData.mat));
      }
    }

    g.userData.tag.position.set(X(r.start) - 6, p.y * 0.55 + 3, p.z * 0.55);
  });

  // The flags ride their ribbon, so they move with it through the whole unroll rather than
  // detaching halfway.
  flagMeshes.forEach((m) => {
    if (!m.userData.ribbon) return;
    const q = ribbonPointAt(m.userData.ribbon, m.userData.ord);
    m.position.set(q.x, q.y, q.z);
  });
  // The connectors join two markers, so they are rebuilt whenever those markers move.
  if (selected) drawLinks(selected);

  threadObjs.forEach((g) => {
    const t = g.userData.data;
    if (g.userData.tube) { g.remove(g.userData.tube); g.userData.tube.geometry.dispose(); }
    if (g.userData.cased) { g.remove(g.userData.cased); g.userData.cased.geometry.dispose(); }
    while (g.userData.glows.length) {
      const gl = g.userData.glows.pop();
      g.remove(gl); gl.geometry.dispose(); gl.material.dispose();
    }
    if (t.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const end = Math.min(t.end, upTo);
    const p = place('thread', t.lane, t.angle);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      const x = X(t.start) + (X(end) - X(t.start)) * f;
      // A thread does not resolve, it recurs -- so it leaves and returns symmetrically
      // rather than arcing out and landing on a payoff the way a subplot does.
      const k = Math.sin(f * Math.PI);
      pts.push(new THREE.Vector3(x, p.y * k, p.z * k));
    }
    const tcurve = new THREE.CatmullRomCurve3(pts);
    const tw = threadWeight(t.id, 0.5);
    const ttaper = (f) => 0.3 + 0.7 * Math.sin(Math.min(1, Math.max(0, f)) * Math.PI);
    const tube = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(tcurve, 50, tw, 6, false), tcurve, 50, 6, ttaper),
      g.userData.mat);
    const tcased = new THREE.Mesh(
      taperTube(new THREE.TubeGeometry(tcurve, 50, tw * 2.3, 6, false), tcurve, 50, 6, ttaper),
      casingMaterial());
    tube.userData = g.userData; tcased.userData = g.userData;
    g.add(tcased); g.add(tube);
    g.userData.tube = tube; g.userData.cased = tcased;
    addGlow(g, tcurve, 50, 6, tw, C.thread,
      GLOW.thread * densityScale(localDensity(t, spine.threads)), ttaper);
    picks.push(tube);
    g.userData.tag.position.set(X(t.start) - 6, p.y * 0.6 + 3, p.z * 0.6);
  });

  strandObjs.forEach((g) => {
    const s = g.userData.data;
    if (g.userData.line) { g.remove(g.userData.line); g.userData.line.geometry.dispose(); }
    if (s.start > upTo) { g.visible = false; return; }
    g.visible = true;
    const p = place('strand', s.lane, s.angle);
    const a = new THREE.Vector3(X(s.start), p.y, p.z);
    const b = new THREE.Vector3(X(Math.min(s.end, upTo)), p.y, p.z);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineDashedMaterial({
        color: C.character, dashSize: 3, gapSize: 3, transparent: true, opacity: 0.5,
      }));
    line.computeLineDistances();
    g.add(line);
    g.userData.line = line;
    g.children.forEach((ch) => {
      if (!ch.userData || !ch.userData.bead) return;
      ch.visible = ch.userData.ord <= upTo;
      ch.position.set(X(ch.userData.ord), p.y, p.z);
    });
    g.userData.tag.position.set(X(s.start) - 8, p.y, p.z);
  });
}

function applyTime() {
  [groups.structure, groups.scenes, groups.flags].forEach((grp) => {
    grp.children.forEach((m) => {
      if (m.userData && m.userData.ord) m.visible = m.userData.ord <= upTo;
    });
  });
  groups.structure.children.forEach((m) => {
    if (m.type === 'Sprite' || m.geometry instanceof THREE.CylinderGeometry) { /* labels follow below */ }
  });
  rebuildCurves();
}

// ---- layers, filters -------------------------------------------------------------
// Plants, reveals and notes are ON from the start. They were off, which is why they
// could not be found: the layer holding the flagged lines was hidden by default.
const shown = { structure: true, scenes: false, flags: true, ribbons: true, threads: false, strands: false };
function syncLayers() {
  groups.structure.visible = shown.structure;
  groups.scenes.visible = shown.scenes;
  groups.flags.visible = shown.flags;
  groups.ribbons.visible = shown.ribbons;
  groups.threads.visible = shown.threads;
  groups.strands.visible = shown.strands;
}
document.querySelectorAll('#layers .row').forEach((el) => {
  el.addEventListener('click', () => {
    const k = el.dataset.layer;
    shown[k] = !shown[k];
    el.classList.toggle('on', shown[k]);
    syncLayers();
  });
});

let filter = 'all';
document.querySelectorAll('#filters .row').forEach((el) => {
  el.addEventListener('click', () => {
    filter = el.dataset.filter;
    document.querySelectorAll('#filters .row').forEach((o) => o.classList.toggle('on', o === el));
    flagMeshes.forEach((m) => {
      const t = m.userData.kind;
      m.visible = filter === 'all'
        || (filter === 'plants' && t === 'plant')
        || (filter === 'reveals' && t === 'reveal')
        || (filter === 'notes' && (t === 'note' || t === 'thread'))
        || (filter === 'unpaid' && t === 'plant' && openIds.has(m.userData.id));
    });
    ribbonObjs.forEach((g) => {
      g.visible = filter === 'all' || filter === 'plants' || filter === 'reveals'
        ? g.userData.data.start <= upTo
        : (filter === 'unpaid' ? (g.userData.data.open && g.userData.data.start <= upTo) : false);
    });
  });
});

// ---- camera: orbit about X, pan along X, never roll --------------------------------
const target = new THREE.Vector3(0, 0, 0);

// The distance that frames the whole saga: half the axis, divided by the tangent of half
// the horizontal field of view. Computed rather than guessed -- a fixed default framed a
// 17-chapter saga from inside the braid.
function framingDistance() {
  const width = Math.max(1, (N - 1) * SLOT) * 0.98;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return Math.max(120, (width / 2) / Math.tan(hFov / 2));
}

// theta is ELEVATION above the spine. The offset is a true spherical one, so dist is
// really the distance; the earlier version scaled y and z differently and put the camera
// a third of the way in from where it claimed to be.
let theta = 0.34, dist = 480;
function updateCamera() {
  camera.position.set(
    target.x,
    target.y + Math.sin(theta) * dist,
    target.z + Math.cos(theta) * dist,
  );
  camera.up.set(0, 1, 0);          // no roll, ever: X keeps a fixed screen direction
  camera.lookAt(target);
  groups.books.rotation.x = -theta;
}

let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, theta, tx: target.x, ty: target.y, moved: false,
           pan: e.button === 2 || e.shiftKey };
  renderer.domElement.setPointerCapture(e.pointerId);
});
let hoverId = null;
let hoverTick = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  // Hover is the same emphasis at a fraction of the strength. Throttled, because a raycast
  // per mouse move over sixty tubes is work nobody asked for.
  if (!drag && !selected && (hoverTick = (hoverTick + 1) % 3) === 0) {
    const v = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(v, camera);
    const cands = [];
    ribbonObjs.forEach((g) => { if (g.visible && g.userData.tube) cands.push(g.userData.tube); });
    const hit = ray.intersectObjects(cands, false)[0];
    const id = hit ? hit.object.userData.data.id : null;
    if (id !== hoverId) {
      hoverId = id;
      applyEmphasis(id ? new Set([id]) : new Set(), 0.45);
    }
  }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (drag.pan) {
    target.x = drag.tx - dx * dist * 0.0016;
    target.y = drag.ty + dy * dist * 0.0016;
  } else {
    theta = Math.max(-1.35, Math.min(1.35, drag.theta - dy * 0.006));
    target.x = drag.tx - dx * dist * 0.0016;
  }
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', (e) => {
  const wasDrag = drag && drag.moved;
  drag = null;
  if (!wasDrag) pick(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  dist = Math.max(45, Math.min(1400, dist * (e.deltaY < 0 ? 0.9 : 1.11)));
  updateCamera();
}, { passive: false });

// ---- picking and the detail sheet ---------------------------------------------------
const ray = new THREE.Raycaster();
let selected = null;
function pick(cx, cy) {
  const v = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(v, camera);
  const candidates = picks.filter((m) => m.visible && m.parent && m.parent.visible);
  ribbonObjs.forEach((g) => { if (g.visible && g.userData.tube) candidates.push(g.userData.tube); });
  const hits = ray.intersectObjects(candidates, false);
  select(hits.length ? hits[0].object.userData : null);
}

function esc(s) {
  return String(s == null || s === '' ? '—' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const row = (k, v) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>';

// Selection contrast, in BOTH directions. Raising the chosen thread alone does not read at
// twenty-one concurrent: it is one bright line among twenty bright lines. So the chosen
// thread goes up in saturation and glow, and every other thread simultaneously drops to a
// low, desaturated state -- still present as context, never invisible.
//
// The cost, stated: unselected threads become transparent while a selection is active, and
// transparent surfaces do not write depth, so the over-under interlacing is degraded for
// the dimmed threads until the selection is cleared. That is the right trade -- when the
// question is "where does this one go", the weave of the others is not the thing being read
// -- but it is a real loss and not a free win.
function applyEmphasis(lit, strength) {
  const active = lit && lit.size > 0;
  ribbonObjs.forEach((g) => {
    const on = active && lit.has(g.userData.data.id);
    const base = g.userData.data.open ? C.ribbonOpen : C.ribbon;
    const mat = g.userData.mat;

    if (!active) {
      mat.color.set(base);
      mat.emissive.set(base);
      mat.emissiveIntensity = 0.22;
      mat.transparent = false;
      mat.opacity = 1;
    } else if (on) {
      // Up in saturation as well as in light: a brighter pale thread still reads pale.
      mat.color.copy(saturated(base, 0.3, 1.25));
      mat.emissive.copy(saturated(base, 0.3, 1.0));
      mat.emissiveIntensity = (0.28 + 0.85 * strength) * (C.glow ? 1 : 0.35);
      mat.transparent = false;
      mat.opacity = 1;
    } else {
      // Dimmed, not drained. An earlier version dropped unselected threads to a tenth of
      // their saturation, which meant one click turned the entire picture grey and the
      // braid stopped looking like dyed thread at all. The contrast now comes from lifting
      // the selected thread rather than from bleaching the other twenty-six: they keep
      // their hue and most of their weight, and simply stop glowing.
      mat.color.copy(saturated(base, -0.12, 0.86));
      mat.emissive.copy(saturated(base, -0.12, 0.5));
      mat.emissiveIntensity = 0.06 * C.glow;
      mat.transparent = true;
      mat.opacity = 1 - 0.4 * strength;
    }
    mat.needsUpdate = true;

    g.userData.glows.forEach((gl) => {
      const rest = gl.userData.restOpacity;
      gl.material.opacity = !active ? rest
        : (on ? Math.min(0.7, rest * (1 + 3.6 * strength)) : rest * (1 - 0.55 * strength));
    });
  });
}

function markersFor(flagId) {
  return flagMeshes.filter((m) => m.userData.id === flagId && m.visible);
}

function drawLinks(u) {
  while (links.children.length) {
    const c = links.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  if (!u || !u.flag || (u.kind !== 'plant' && u.kind !== 'reveal')) return;

  const outward = u.kind === 'plant' ? C.plant : C.reveal;
  const from = markersFor(u.id);
  if (!from.length) return;

  (counterparts[u.id] || []).forEach((other) => {
    markersFor(other.id).forEach((to) => {
      from.forEach((f) => {
        // Bowed, not straight. A chord cutting across the braid reads as a different kind
        // of thing from the arcs around it; bowing it outward from the spine -- the same
        // direction the subplot itself departs in -- makes the connector read as the same
        // gesture drawn thinner.
        const a = f.position.clone(), b = to.position.clone();
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y *= 1.45;
        mid.z *= 1.45;
        // Two flags both sitting on the axis would give a midpoint on the axis and a dead
        // straight line, so give it somewhere to bow to.
        if (Math.hypot(mid.y, mid.z) < 4) mid.y -= 9;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(44));
        links.add(new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: outward, transparent: true, opacity: 0.85,
        })));
      });
    });
  });
}

function select(u) {
  // Selecting either END of a pair lights the ribbon between them: that is the answer to
  // "where does this go", and it should not require finding the tube by eye first.
  const litRibbons = new Set();
  if (u && u.kind === 'ribbon') litRibbons.add(u.data.id);
  if (u && u.flag) {
    if (u.ribbon) litRibbons.add(u.ribbon.id);
    (u.data.pairs || []).forEach((m) => litRibbons.add(m.id));
  }
  applyEmphasis(litRibbons, 1);
  selected = u;
  const box = document.getElementById('detail');
  if (!u) { box.classList.remove('on'); drawLinks(null); return; }
  const d = u.data;
  let head = '', sub = '', body = '';
  if (u.kind === 'chapter') {
    head = d.title; sub = 'Book ' + (d.book + 1) + ' · Act ' + d.act;
    body = row('position', 'chapter ' + u.ord + ' of ' + N)
      + row('words', d.words) + row('scenes', (scenesByChapter[d.id] || []).length)
      + row('status', d.status);
  } else if (u.kind === 'scene') {
    head = d.title || 'Untitled scene'; sub = 'Scene';
    body = row('told by', d.pov) + row('summary', clip(d.summary, 190));
  } else if (u.kind === 'ribbon') {
    head = d.label; sub = 'Subplot';
    body = row('opens', 'chapter ' + d.start)
      + row(d.open ? 'status' : 'resolves', d.open ? 'still open — nothing claims it' : 'chapter ' + d.end)
      + row('planted', d.plants.length) + row('revealed', d.reveals.length)
      + row('spans', d.spansBooks + (d.spansBooks === 1 ? ' book' : ' books'));
  } else if (u.kind === 'thread-arc') {
    head = d.label; sub = 'Mythic thread';
    body = row('first touch', 'chapter ' + d.start) + row('last touch', 'chapter ' + d.end)
      + row('touches', d.touches.length)
      + row('spans', d.spansBooks + (d.spansBooks === 1 ? ' book' : ' books'));
  } else if (u.kind === 'strand') {
    head = d.label; sub = 'Character';
    body = row('first seen', 'chapter ' + d.start) + row('last seen', 'chapter ' + d.end)
      + row('appears in', d.beads.length + ' of ' + N + ' chapters')
      + row('gaps mean', 'no moment recorded — not absence');
  } else {
    head = d.label || clip(d.text, 40);
    sub = u.kind === 'thread' ? 'Mythic thread' : u.kind[0].toUpperCase() + u.kind.slice(1);
    body = row('position', 'chapter ' + u.ord)
      + row('attached to', d.sceneId ? 'a scene' : 'the whole chapter')
      + row('subplots', (d.pairs || []).map((p) => p.label || p.id).join(', '))
      + row('the line', clip(d.text, 200));

    // The far end, in words. The ribbon draws it, but "where is this answered" should be
    // readable without following a curve across the screen -- and for an unpaid plant the
    // answer is a real state to report, not an empty list.
    const others = counterparts[d.id] || [];
    if (u.kind === 'plant') {
      body += others.length
        ? row('paid off in', others.map((o) => {
            const g = flagById[o.id];
            return g ? 'chapter ' + axis.ordinal[g.chapterId] + ' — ' + clip(g.label || g.text, 34) : '?';
          }).join('; '))
        : row('paid off in', 'nothing claims this yet');
    } else if (u.kind === 'reveal') {
      body += others.length
        ? row('planted in', others.map((o) => {
            const g = flagById[o.id];
            return g ? 'chapter ' + axis.ordinal[g.chapterId] + ' — ' + clip(g.label || g.text, 34) : '?';
          }).join('; '))
        : row('planted in', 'not joined to a plant');
    }
  }
  document.getElementById('dbody').innerHTML =
    '<h2>' + esc(head) + '</h2><div class="sub">' + esc(sub) + '</div><dl>' + body + '</dl>';
  box.classList.add('on');
  drawLinks(u);
}
document.getElementById('dclose').addEventListener('click', () => select(null));

// ---- index -------------------------------------------------------------------------
const TABS = {
  Chapters: () => axis.sorted.map((c) => ({
    label: clip(c.title, 30), note: 'ch ' + axis.ordinal[c.id],
    go: () => { focusOn(X(axis.ordinal[c.id])); select(chapterMesh[c.id].userData); },
  })),
  Subplots: () => spine.ribbons.map((r) => ({
    label: clip(r.label, 30), note: r.open ? 'open' : r.start + '–' + r.end,
    go: () => { shown.ribbons = true; syncLayers(); focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); },
  })),
  Characters: () => spine.strands.map((s) => ({
    label: s.label, note: s.beads.length + ' ch',
    go: () => { shown.strands = true; syncLayers(); document.querySelector('[data-layer=strands]').classList.add('on'); focusOn(X(s.start)); select({ kind: 'strand', data: s, ord: s.start }); },
  })),
  Threads: () => spine.threads.map((t) => ({
    label: clip(t.label, 30), note: t.touches.length + ' touches',
    go: () => { shown.threads = true; syncLayers();
      document.querySelector('[data-layer=threads]').classList.add('on');
      focusOn(X(t.start)); select({ kind: 'thread-arc', data: t, ord: t.start }); },
  })),
  Open: () => spine.ribbons.filter((r) => r.open).map((r) => ({
    label: clip(r.label, 30), note: 'from ' + r.start,
    go: () => { shown.ribbons = true; syncLayers(); focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); },
  })),
};
let tab = 'Chapters';
function renderIndex() {
  document.getElementById('tabs').innerHTML = Object.keys(TABS)
    .map((t) => '<button class="' + (t === tab ? 'on' : '') + '" data-tab="' + t + '">' + t + '</button>').join('');
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab; renderIndex();
  }));
  const items = TABS[tab]();
  const list = document.getElementById('ilist');
  list.innerHTML = items.map((it, i) =>
    '<div class="item" data-i="' + i + '">' + esc(it.label) + '<span>' + esc(it.note) + '</span></div>').join('')
    || '<div class="item" style="color:#7f8fa0">nothing here yet</div>';
  list.querySelectorAll('.item').forEach((el) => {
    if (el.dataset.i === undefined) return;
    el.addEventListener('click', () => items[+el.dataset.i].go());
  });
}
function focusOn(x) { target.x = x; dist = Math.min(dist, framingDistance() * 0.4); updateCamera(); }

// ---- flatten, scrub, reset ----------------------------------------------------------
const flatSw = document.getElementById('flat');
flatSw.addEventListener('click', () => {
  const to = flatten > 0.5 ? 0 : 1;
  flatSw.classList.toggle('on', to === 1);
  const from = flatten, t0 = performance.now();
  (function step(now) {
    const p = Math.min(1, (now - t0) / 520);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    flatten = from + (to - from) * e;
    rebuildCurves();
    if (p < 1) requestAnimationFrame(step);
  })(t0);
});

const slider = document.getElementById('upto');
slider.max = String(N); slider.value = String(N);
slider.addEventListener('input', () => {
  upTo = +slider.value;
  document.getElementById('uptolab').textContent = 'showing the saga up to chapter ' + upTo;
  applyTime();
});

// Switching the axis re-ranks every chapter, which moves every other coordinate with it --
// lanes, ribbons, flags and all. Rather than mutate a live scene into an inconsistent
// half-state, the page reloads under the other ordering. It is the honest, cheap answer for
// a prototype; the real renderer would rebuild in place.
const orderSw = document.getElementById('order');
const params = new URLSearchParams(location.search);
const wantStory = params.get('order') === 'story';
orderSw.classList.toggle('on', wantStory);
if (!axis.storyTimesSet) {
  document.getElementById('orderLabel').textContent = 'As it happened — no times set';
  orderSw.classList.add('dim');
}
orderSw.addEventListener('click', () => {
  if (!axis.storyTimesSet) return;      // nothing to reorder by; the label already says so
  params.set('order', wantStory ? 'read' : 'story');
  location.search = params.toString();
});

document.getElementById('reset').addEventListener('click', () => {
  theta = 0.34; dist = framingDistance(); target.set(0, 0, 0); updateCamera();
});
document.getElementById('top').addEventListener('click', () => {
  theta = 1.3; dist = framingDistance() * 0.85; target.set(0, 0, 0); updateCamera();
});

// ---- go ------------------------------------------------------------------------------
// Landscape is the supported orientation; portrait on a narrow viewport shows the prompt
// instead of the graph. Nothing is disposed and no state is reset, so rotating back reveals
// the same scene at the same camera position with no reload.
// The braid always renders. An earlier version refused portrait on a narrow viewport and
// asked the reader to rotate, which was wrong twice over: it fired on laptops whose
// dimensions or pointer type were transiently misread, and even where it fired correctly it
// made the reader do work the app should do. A narrow window shows a narrower slice of the
// axis, which pans and zooms like any other view.

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Some environments resize the viewport without emitting a resize event -- device
// emulators and embedded panes among them -- which leaves the canvas at a stale size.
// Observing the element itself catches those.
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }).observe(document.documentElement);
}

document.getElementById('subtitle').textContent =
  window.__SOURCE__ + ' · ' + N + ' chapters · ' + axis.books.length + ' book(s) · ' +
  raw.flags.length + ' flagged · ' + spine.ribbons.length + ' subplots · ' +
  spine.ribbons.filter((r) => r.open).length + ' still open' +
  (axis.order === 'story' ? ' · ordered as it happened' : '');
document.getElementById('uptolab').textContent = 'showing the whole saga';
document.getElementById('bar').hidden = false;
document.getElementById('scrub').hidden = false;

// One dropdown open at a time, and any touch of the canvas closes them: the braid should
// never be competing with a panel for the screen.
const dds = Array.prototype.slice.call(document.querySelectorAll('.dd'));
dds.forEach((d) => d.addEventListener('toggle', () => {
  if (d.open) dds.forEach((o) => { if (o !== d) o.open = false; });
}));
renderer.domElement.addEventListener('pointerdown', () => {
  dds.forEach((d) => { d.open = false; });
});
document.getElementById('boot').style.display = 'none';

syncLayers();
renderIndex();
applyTime();
dist = framingDistance();
updateCamera();

// A label nobody can read is worse than no label: twenty-seven subplot names at saga zoom
// rendered as a single illegible smear across the braid. So names appear when there is room
// for them -- chapter titles as the camera comes in, a subplot's name when it is open (there
// are few of those and they are the ones worth naming) or when it is the thing selected.
function updateLabels() {
  const frame = framingDistance();
  const near = dist < frame * 0.55;

  // Collision avoidance, in screen space. Overlapping titles read as a rendering fault
  // whatever the palette, so this runs before anything cosmetic can matter: each candidate
  // is projected, and one that would land on a label already placed is simply not drawn.
  // Nearest-to-centre wins, so the thing being looked at keeps its name.
  const placed = [];
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const fits = (sp, padPx) => {
    const v = sp.position.clone().project(camera);
    if (v.z > 1) return null;
    const x = (v.x + 1) / 2 * innerWidth;
    const y = (-v.y + 1) / 2 * innerHeight;
    // Measure the sprite's real screen width by projecting a point half its world width
    // away along the camera's right vector. The previous estimate was a fudge factor and
    // hid almost every title.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const edge = sp.position.clone().add(right.multiplyScalar(sp.scale.x / 2)).project(camera);
    const ex = (edge.x + 1) / 2 * innerWidth;
    const w = Math.max(24, Math.abs(ex - x) * 2) + padPx;
    const h = 15 + padPx;
    if (x < -w || x > innerWidth + w || y < -h || y > innerHeight + h) return null;
    return { x, y, w, h, d: Math.hypot(x - cx, y - cy) };
  };
  const claim = (box) => {
    for (const p of placed) {
      if (Math.abs(box.x - p.x) < (box.w + p.w) / 2 && Math.abs(box.y - p.y) < (box.h + p.h) / 2) {
        return false;
      }
    }
    placed.push(box);
    return true;
  };

  const candidates = [];
  chapterTitles.forEach((t) => {
    if (!near || t.userData.ord > upTo || !groups.structure.visible) { t.visible = false; return; }
    const box = fits(t, 10);
    if (!box) { t.visible = false; return; }
    candidates.push({ sprite: t, box });
  });
  ribbonObjs.forEach((g) => {
    const r = g.userData.data;
    const want = g.visible && (r.open || (selected && selected.kind === 'ribbon' && selected.data.id === r.id));
    if (!want) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });
  threadObjs.forEach((g) => {
    if (!g.visible || !groups.threads.visible) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });
  strandObjs.forEach((g) => {
    if (!g.visible || !groups.strands.visible) { g.userData.tag.visible = false; return; }
    const box = fits(g.userData.tag, 8);
    if (!box) { g.userData.tag.visible = false; return; }
    candidates.push({ sprite: g.userData.tag, box });
  });

  candidates.sort((a, b) => a.box.d - b.box.d);
  candidates.forEach((c) => { c.sprite.visible = claim(c.box); });

  // How large is a bead on screen, in device pixels? One projection answers it, and every
  // detail decision below follows from the answer rather than from a distance threshold.
  const beadPx = markScreenSize(2.5 * 1.35) * (window.devicePixelRatio || 1);
  const wantGrain = beadPx >= (grainOn ? PX_GRAIN - PX_HYST : PX_GRAIN);
  const wantBig = beadPx >= (detailOn ? PX_DETAIL - PX_HYST : PX_DETAIL);
  if (wantGrain !== grainOn || wantBig !== detailOn) {
    grainOn = wantGrain;
    detailOn = wantBig;
    beadTextures.forEach((b) => {
      if (detailOn && !b.grainBig) {
        b.grainBig = b.own(beadTexture(b.chapter, true, true));
        b.plainBig = b.own(beadTexture(b.chapter, false, true));
      }
      b.mat.map = detailOn
        ? (grainOn ? b.grainBig : b.plainBig)
        : (grainOn ? b.grainSmall : b.plainSmall);
      b.mat.needsUpdate = true;
    });
    markMaterials.forEach((m) => {
      m.mat.map = grainOn && m.grain ? m.grain : m.plain;
      m.mat.needsUpdate = true;
    });
  }

  chapterNumerals.forEach((n) => {
    n.visible = groups.structure.visible && n.userData.ord <= upTo && dist < frame * 0.8;
  });
}

(function loop() {
  requestAnimationFrame(loop);
  updateLabels();
  renderer.render(scene, camera);
})();

// Inspection handle. The same reasoning as the flat prototype's: the claims this makes --
// that a flag sits on its own ribbon, that selecting one end draws connectors to the other
// -- are only checkable from outside if the selection path is reachable from outside.
// Focus at any granularity, the same contract the character web answers: one id, which may
// be a chapter, a scene or a single flagged line. No translation is needed at either end
// because all three are keyed by their own database id here too.
function focusNode(id) {
  // Searched across the collections the braid actually keeps rather than through a single
  // lookup table: a chapter, a scene, a flagged line, a subplot and a thread live in
  // different groups here, and all five are addressed by their own database id.
  const chapter = chapterMesh[id];
  if (chapter) { focusOn(X(chapter.userData.ord)); select(chapter.userData); return; }

  const flag = flagMeshes.find((m) => m.userData.id === id);
  if (flag) {
    shown.flags = true; syncLayers();
    focusOn(X(flag.userData.ord)); select(flag.userData); return;
  }

  const scene = groups.scenes.children.find((m) => m.userData && m.userData.id === id);
  if (scene) {
    shown.scene = true; groups.scenes.visible = true;
    focusOn(X(scene.userData.ord)); select(scene.userData); return;
  }

  const ribbon = ribbonObjs.find((g) => g.userData.data.id === id);
  if (ribbon) {
    shown.ribbons = true; syncLayers();
    const r = ribbon.userData.data;
    focusOn(X(r.start)); select({ kind: 'ribbon', data: r, ord: r.start }); return;
  }

  const thread = threadObjs.find((g) => g.userData.data.id === id);
  if (thread) {
    shown.threads = true; syncLayers();
    const t = thread.userData.data;
    focusOn(X(t.start)); select({ kind: 'thread-arc', data: t, ord: t.start }); return;
  }
  // Anything else has been deleted since the caller opened the view; ignoring it is the
  // right answer, and the same one the character web gave.
}

function hostMessage(e) {
  let msg;
  try { msg = JSON.parse(e.data); } catch (err) { return; }
  if (msg && msg.type === 'focus' && msg.id) focusNode(msg.id);
}
window.addEventListener('message', hostMessage);
document.addEventListener('message', hostMessage);

window.__BRAID__ = {
  spine, scene, camera, groups, links, flagMeshes, counterparts,
  select, drawLinks, shown,
  flatten: () => flatten,
  focusNode,
  // Peak additive glow opacity summed across every thread overlapping one chapter. This is
  // the number the density guard exists to hold down, and it is reachable so the guard can
  // be checked instead of trusted.
  peakGlow: () => {
    let peak = 0, at = 0;
    for (let o = 1; o <= N; o++) {
      let sum = 0;
      spine.ribbons.forEach((r) => {
        if (r.start > o || r.end < o) return;
        sum += (r.open ? GLOW.open : GLOW.ribbon) * densityScale(localDensity(r, spine.ribbons));
      });
      if (sum > peak) { peak = sum; at = o; }
    }
    return { peak: +peak.toFixed(3), atChapter: at };
  },
};
</script>
`;

if (HTML.indexOf('`') !== -1) throw new Error('backtick in the braid markup');

const out = HTML
  .replace('/*__PAYLOAD__*/', payload
    ? ('window.__GRAPH__ = ' + JSON.stringify(payload) + ';\n' +
       'window.__SOURCE__ = ' + JSON.stringify(sourceName) + ';')
    : 'window.__SOURCE__ = "";')
  .replace('/*__LAYOUT__*/', layout);

const banner = '<!-- GENERATED FILE - do not edit by hand.\n' +
  '     Geometry from graph/spine-layout.mjs. Rebuild: node scripts/build-braid-3d.mjs' +
  (useLocal ? ' --local' : useEmbed ? ' --embed' : '') + ' -->\n';

fs.writeFileSync(OUT, banner + out, 'utf8');

const describe = (f) => path.relative(ROOT, f).replace(/\\/g, '/') + '  ' +
  (fs.statSync(f).size / 1024).toFixed(0) + ' KB';

if (useEmbed) {
  // The phone loads the document as a string rather than fetching a file, so the same
  // markup is emitted as a TypeScript module. A backtick anywhere inside would end the
  // String.raw template and break the module while still producing a page that looks fine
  // -- the same trap build-graph-demo.mjs guards, for the same reason.
  if (out.includes('`')) {
    throw new Error('The braid markup contains a backtick, which would terminate its String.raw template.');
  }
  const ts = '// GENERATED FILE - do not edit by hand.\n' +
    '// Rebuild with: node scripts/build-braid-3d.mjs --embed\n' +
    '//\n' +
    '// The braid, as one document. The PWA loads braid.html in an iframe; the phone loads\n' +
    '// this string in a WebView. Neither carries data: both post it in after the page says\n' +
    '// it is ready, which is the handshake the character web used before it.\n' +
    'export const BRAID_HTML = String.raw`' + out + '`;\n';
  fs.writeFileSync(OUT_TS, ts, 'utf8');
  console.log(describe(OUT) + '   (no data; the host posts it)');
  console.log(describe(OUT_TS));
} else {
  console.log(describe(OUT) + '  ' + payload.chapters.length + ' chapters, ' +
    payload.flags.length + ' flags, source: ' + sourceName);
}
