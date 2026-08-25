// The spine prototype: phases 2 through 5 plus the health overlays, laid out on one fixed
// saga axis, for looking at beside the existing force-directed web before anything in
// characterWebHtml.ts is touched.
//
//   graph/spine-prototype.html
//
// Run: node scripts/build-graph-demo.mjs && node scripts/build-spine-prototype.mjs
//      node scripts/test-spine-layout.mjs      (the geometry's own tests)
//
// Two things this file deliberately does not do:
//
//   It does not derive the payload. That is read back out of graph/character-web-demo.html,
//   so the prototype is looking at literally the bytes the real renderer is handed.
//
//   It does not compute any geometry. All of that is graph/spine-layout.mjs, inlined below
//   and imported by the tests, so the thing under test is the thing that renders.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEMO = path.join(ROOT, 'graph', 'character-web-demo.html');
const LAYOUT = path.join(ROOT, 'graph', 'spine-layout.mjs');
const OUT_DEMO = path.join(ROOT, 'graph', 'spine-prototype.html');
const OUT_LOCAL = path.join(ROOT, 'graph', '.local-spine-prototype.html');

if (!fs.existsSync(DEMO)) {
  throw new Error('graph/character-web-demo.html is missing. Run: node scripts/build-graph-demo.mjs');
}

// --local builds against graph/.local-project.json (a real manuscript, dumped by
// scripts/dump-project-structure.mjs) instead of the demo fixture. The output goes to a
// separate file, because that one contains chapter titles and must not be committed.
const useLocal = process.argv.includes('--local');
const LOCAL = path.join(ROOT, 'graph', '.local-project.json');

let payload;
if (useLocal) {
  if (!fs.existsSync(LOCAL)) {
    throw new Error('graph/.local-project.json is missing. Run: node scripts/dump-project-structure.mjs <projectId>');
  }
  payload = JSON.parse(fs.readFileSync(LOCAL, 'utf8')).payload;
  for (const key of ['chapters', 'scenes', 'flags', 'events']) payload[key] = payload[key] || [];
} else {
  const demo = fs.readFileSync(DEMO, 'utf8');
  const at = demo.indexOf('window.__GRAPH__ = ');
  if (at === -1) throw new Error('Could not find window.__GRAPH__ in the demo page.');
  const open = demo.indexOf('{', at);
  const close = demo.indexOf('};', open);
  if (close === -1) throw new Error('Could not find the end of the __GRAPH__ literal.');
  payload = JSON.parse(demo.slice(open, close + 1));
}

for (const key of ['chapters', 'scenes', 'flags', 'events']) {
  if (!Array.isArray(payload[key])) throw new Error('Payload is missing ' + key + '.');
}

// The layout core, inlined rather than duplicated. Only the module keywords are stripped.
const layout = fs.readFileSync(LAYOUT, 'utf8')
  .replace(/^export (const|function) /gm, '$1 ')
  .replace(/^export \{[^}]*\};?$/gm, '');
if (/\bexport\b/.test(layout)) throw new Error('spine-layout.mjs still has an export the inliner missed.');

const HTML = String.raw`<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>StoryMap — the saga spine</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0d1110;
    font: 13px/1.45 -apple-system, system-ui, sans-serif; color: #cfd8d5; }
  #cv { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
  #cv.drag { cursor: grabbing; }
  #hud { position: fixed; top: 0; left: 0; right: 0; padding: 8px 10px; display: flex;
    gap: 6px; align-items: center; flex-wrap: wrap;
    background: linear-gradient(#0d1110ee, #0d111000); pointer-events: none; }
  #hud > * { pointer-events: auto; }
  .chip { border: 1px solid #2c3733; background: #141a18; color: #cfd8d5; border-radius: 999px;
    padding: 5px 11px; font-size: 12px; cursor: pointer; }
  .chip.on { border-color: #c69a3a; color: #f2c94c; background: rgba(198,154,58,0.18); }
  #tail { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 11px; color: #7f8fa0; }
  #upto { width: 150px; }
  #focus { position: fixed; left: 0; right: 0; bottom: 0; max-height: 38vh; overflow: auto;
    background: #141a18; border-top: 1px solid #2c3733; padding: 12px 14px 16px;
    transform: translateY(100%); transition: transform .18s ease; }
  #focus.open { transform: none; }
  #focus h2 { margin: 0 0 6px; font-size: 14px; color: #f2c94c; font-weight: 600; }
  #focus dl { margin: 0 0 8px; display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; }
  #focus dt { color: #7f8fa0; }
  #focus dd { margin: 0; }
  .warn { color: #f2c94c; }
  #dismiss { border: 1px solid #2c3733; background: #0d1110; color: #cfd8d5;
    border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  #close { position: absolute; top: 8px; right: 10px; background: none; border: 0;
    color: #7f8fa0; font-size: 20px; cursor: pointer; line-height: 1; }
</style>

<canvas id="cv"></canvas>
<div id="hud">
  <button class="chip" id="t-scene">Scenes</button>
  <button class="chip" id="t-flag">Plants &amp; Reveals</button>
  <button class="chip" id="t-ribbon">Subplots</button>
  <button class="chip" id="t-strand">Characters</button>
  <button class="chip" id="t-moment">Moments</button>
  <button class="chip" id="t-health">Trouble marks</button>
  <button class="chip" id="t-round">Wrap around</button>
  <button class="chip" id="fit">Fit</button>
  <div id="tail">
    <label for="upto">up to</label><input type="range" id="upto" min="1" value="1"><span id="uptoLabel"></span>
    <span id="count"></span>
  </div>
</div>
<div id="focus"><button id="close">&times;</button><div id="body"></div></div>

<script>/*__PAYLOAD__*/</script>
<script>
/*__LAYOUT__*/
</script>
<script>
(function () {
  var raw = window.__GRAPH__;

  var CHAPTER_COLOR = '#8e7cc3', SCENE_COLOR = '#6d7f96', EVENT_COLOR = '#7f8fa0';
  var PLANT_COLOR = '#5aa469', REVEAL_COLOR = '#c0504d', NOTE_COLOR = '#b08a5a';
  var THREAD_COLOR = '#3aa8a0', STRUCTURE_COLOR = '#6b5f8a', GOLD = '#c69a3a';

  var SLOT = 150, SPINE_Y = 0, EVENT_Y = -70, SCENE_Y = 62, FLAG_Y = 118, FLAG_ROW = 30;
  var RIBBON_BASE = 250, RIBBON_GAP = 26, RIBBON_RADIUS = 210;
  var STRAND_BASE = 150, STRAND_GAP = 24, STRAND_RADIUS = 130;
  var GUTTER_PAD = 2;

  // Dismissals are written onto the annotation -- health_dismissed on the flag, inside the
  // chapters.annotations jsonb the editor already writes -- and never into localStorage.
  // This app syncs across devices through one Supabase project; a dismissal stored on the
  // device means the signal comes back on the phone after being silenced on the laptop,
  // which is exactly what teaches a writer to ignore every badge.
  //
  // There is no database in the prototype, so the write is made in memory and the exact
  // statement it stands for is queued and shown. Nothing is persisted locally on purpose:
  // a prototype that fakes durability hides the only part still to be built.
  var pendingWrites = [];
  function dismissAnnotation(id) {
    var f = flagById[id];
    if (f) {
      f.health_dismissed = true;
      pendingWrites.push({
        table: 'chapters', chapterId: f.chapterId, annotationId: f.id,
        sql: 'update chapters set annotations = <annotations with ' + f.id +
             '.health_dismissed = true> where id = ' + f.chapterId,
      });
    } else {
      // A subplot is a grouping, not a row -- it has no annotation to carry the flag. It
      // has to be dismissed on every plant in it, or the grouping needs a home of its own.
      ribbonDismissals[id] = true;
    }
  }
  var ribbonDismissals = {};

  // The previous assignment, so a rebuild keeps the picture rather than reshuffling it.
  // In the app this is persisted per project and per class; here it lives for the session.
  var previous = null;
  function recompute() {
    spine = computeSpine(raw, { dismissals: ribbonDismissals, previous: previous });
    previous = spine.assignment;
    indexHealth();
  }

  var spine = computeSpine(raw, { dismissals: {} });
  previous = spine.assignment;
  var axis = spine.axis, slots = axis.slots;
  var show = spine.preset.visible;

  var chapterById = {}, sceneById = {}, flagById = {};
  raw.chapters.forEach(function (c) { chapterById[c.id] = c; });
  raw.scenes.forEach(function (s) { sceneById[s.id] = s; });
  raw.flags.forEach(function (f) { flagById[f.id] = f; });

  var healthBySubject = {};
  function indexHealth() {
    healthBySubject = {};
    spine.health.signals.forEach(function (s) {
      (healthBySubject[s.subject] = healthBySubject[s.subject] || []).push(s);
    });
  }
  indexHealth();

  function slotX(o) { return (o - 1) * SLOT; }

  // ---- nodes on the axis (radius 0) -----------------------------------------------
  var nodes = [];
  axis.sorted.forEach(function (c) {
    nodes.push({ id: c.id, kind: 'chapter', label: c.title, x: slotX(axis.ordinal[c.id]),
                 y: SPINE_Y, r: 15, data: c, ord: axis.ordinal[c.id] });
  });

  var scenesByChapter = {}, sceneX = {};
  raw.scenes.forEach(function (s) {
    (scenesByChapter[s.chapterId] = scenesByChapter[s.chapterId] || []).push(s);
  });
  Object.keys(scenesByChapter).sort().forEach(function (cid) {
    var list = scenesByChapter[cid].slice().sort(function (a, b) { return a.seq - b.seq; });
    var base = slotX(axis.ordinal[cid]);
    list.forEach(function (s, i) {
      var x = base + ((i + 1) / (list.length + 1) - 0.5) * SLOT * 0.78;
      sceneX[s.id] = x;
      nodes.push({ id: s.id, kind: 'scene', label: s.title || 'Untitled scene', x: x, y: SCENE_Y,
                   r: 7, data: s, ord: axis.ordinal[cid] });
    });
  });

  // Plants, Reveals and Notes sit ON the axis; the vertical offset below is legibility,
  // not a coordinate, which is why none of them move when the view wraps around. A
  // chapter-anchored flag has no finer position to inherit -- 64 of 79 in this material --
  // so they fan across their chapter's stretch and stack in rows rather than piling onto
  // one point.
  var byAnchor = {};
  raw.flags.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (f) {
    var key = (f.sceneId && sceneX[f.sceneId] !== undefined) ? 'scene:' + f.sceneId : 'chapter:' + f.chapterId;
    (byAnchor[key] = byAnchor[key] || []).push(f);
  });
  Object.keys(byAnchor).sort().forEach(function (key) {
    var list = byAnchor[key];
    var isScene = key.indexOf('scene:') === 0;
    var anchorId = key.slice(key.indexOf(':') + 1);
    var cid = isScene ? sceneById[anchorId].chapterId : anchorId;
    var base = isScene ? sceneX[anchorId] : slotX(axis.ordinal[cid]);
    var span = isScene ? SLOT * 0.22 : SLOT * 0.74;
    var perRow = isScene ? 2 : 4;
    list.forEach(function (f, i) {
      var col = i % perRow, row = Math.floor(i / perRow);
      var inRow = Math.min(perRow, list.length - row * perRow);
      nodes.push({
        id: f.id, kind: (f.type === 'note' && f.thread) ? 'thread' : f.type,
        label: f.label || (f.text || '').slice(0, 40),
        x: base + (inRow === 1 ? 0 : (col / (inRow - 1) - 0.5)) * span,
        y: FLAG_Y + row * FLAG_ROW, r: 7, data: f, ord: axis.ordinal[cid],
      });
    });
  });

  // A moment with no chapter is NOT interpolated between its neighbours: an invented
  // position looks exactly as precise as a real one. Parked past the end, drawn hollow.
  var gutter = 0;
  raw.events.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (ev) {
    var cid = (ev.properties || {}).chapter_id;
    var o = cid ? axis.ordinal[cid] : null;
    nodes.push(o
      ? { id: ev.id, kind: 'event', label: ev.label, x: slotX(o), y: EVENT_Y, r: 10, data: ev, ord: o }
      : { id: ev.id, kind: 'event', label: ev.label, x: slotX(slots + GUTTER_PAD + gutter++),
          y: EVENT_Y, r: 10, data: ev, ord: null, unanchored: true });
  });

  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  spine.ribbons.forEach(function (r) { byId[r.id] = r; });
  spine.strands.forEach(function (s) { byId[s.id] = s; });

  // ---- view -----------------------------------------------------------------------
  var cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  var view = { x: 0, y: 0, k: 1 };
  var cam = 0;             // orbit about the axis. No roll: the axis stays horizontal.
  var roundness = 0;       // 0 flat, 1 wrapped. Animated between the two.
  var upTo = slots;        // the time scrubber: show the saga up to this chapter
  var selectedId = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Flat and wrapped are one geometry seen two ways: the flat offset is the same packing
  // the angle came from, so this blend is an unroll, not a cross-fade between layouts.
  function offsetOf(radius, lane, angle) {
    var flat, r;
    if (radius === RADIUS.ribbon) { flat = RIBBON_BASE + lane * RIBBON_GAP; r = RIBBON_RADIUS; }
    else if (radius === RADIUS.strand) { flat = -(STRAND_BASE + lane * STRAND_GAP); r = -STRAND_RADIUS; }
    else return { y: 0, depth: 1 };
    var wrapped = r * Math.cos(angle + cam);
    return { y: flat * (1 - roundness) + wrapped * roundness,
             depth: Math.sin(angle + cam) * roundness };
  }

  function tier() { return tierFor(view.k); }
  function inTime(ord) { return !ord || ord <= upTo; }

  function visible(n) {
    if (!inTime(n.ord)) return false;
    var t = tier();
    if (t === 'books') return false;
    if (n.kind === 'chapter') return true;
    if (n.kind === 'scene') return show.scene !== false && t !== 'books';
    if (n.kind === 'event') return show.moment === true && t === 'detail';
    return show.flags === true && t === 'detail';
  }

  function colorOf(n) {
    return n.kind === 'chapter' ? CHAPTER_COLOR : n.kind === 'scene' ? SCENE_COLOR
      : n.kind === 'event' ? EVENT_COLOR : n.kind === 'plant' ? PLANT_COLOR
      : n.kind === 'reveal' ? REVEAL_COLOR : n.kind === 'thread' ? THREAD_COLOR : NOTE_COLOR;
  }

  function shape(c, kind, x, y, r) {
    c.beginPath();
    if (kind === 'chapter') {
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 6 + i * Math.PI / 3;
        c[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
      }
      c.closePath();
    } else if (kind === 'event') {
      c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath();
    } else if (kind === 'scene') {
      c.rect(x - r, y - r, r * 2, r * 2);
    } else if (kind === 'plant') {
      c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath();
    } else if (kind === 'reveal') {
      c.moveTo(x, y + r); c.lineTo(x + r, y - r * 0.8); c.lineTo(x - r, y - r * 0.8); c.closePath();
    } else {
      var f = r * 0.55;
      c.moveTo(x - r, y - r); c.lineTo(x + r - f, y - r); c.lineTo(x + r, y - r + f);
      c.lineTo(x + r, y + r); c.lineTo(x - r, y + r); c.closePath();
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d1110';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, view.x * dpr, view.y * dpr);

    var top = (-view.y / view.k) - 40;
    var bot = top + (cv.height / dpr) / view.k + 80;
    var t = tier();
    var lw = function (px) { return px / view.k; };

    // Bands. Books at every zoom, acts only once chapters are being drawn -- the far view
    // is books and their counts, and nothing else.
    // The far tier is whatever actually summarises this saga -- books when they divide it
    // usefully, acts when one book dominates. Decided in computeAxis so the renderer and
    // any count agree; a far view whose largest band is most of the axis summarises nothing.
    var farBands = axis.farTier === 'books' ? axis.books : axis.acts;
    var bands = (t === 'books' ? farBands : axis.acts).filter(function (b) { return b.from <= upTo; });
    bands.forEach(function (b, i) {
      var x0 = slotX(b.from) - SLOT / 2, x1 = slotX(Math.min(b.to, upTo)) + SLOT / 2;
      ctx.fillStyle = i % 2 ? 'rgba(107,95,138,0.09)' : 'rgba(107,95,138,0.045)';
      ctx.fillRect(x0, top, x1 - x0, bot - top);
      ctx.strokeStyle = 'rgba(107,95,138,0.35)';
      ctx.lineWidth = lw(1);
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bot); ctx.stroke();

      ctx.fillStyle = '#6b5f8a';
      ctx.font = lw(t === 'books' ? 20 : 12) + 'px system-ui';
      ctx.textAlign = 'left';
      var label = b.label + '  —  ' + b.chapters + ' chapters · ' + b.flags + ' flagged';
      if (b.open) label += ' · ' + b.open + ' still open';
      ctx.fillText(label, x0 + lw(8), top + lw(t === 'books' ? 32 : 20));
    });

    if (t === 'books') { hud(); return; }

    // The spine.
    ctx.strokeStyle = STRUCTURE_COLOR;
    ctx.lineWidth = lw(2);
    ctx.beginPath();
    ctx.moveTo(slotX(1), SPINE_Y); ctx.lineTo(slotX(upTo), SPINE_Y);
    ctx.stroke();

    // Subplots. Each leaves the spine where its first Plant is sown and rejoins where its
    // last Reveal lands. One that is never claimed does not simply fade: it ends in a bar,
    // a mark that is still there at any zoom and cannot be mistaken for something faint,
    // distant or hidden behind the spine.
    if (show.ribbons) {
      spine.ribbons.slice()
        .sort(function (a, b) { return offsetOf(RADIUS.ribbon, a.lane, a.angle).depth -
                                       offsetOf(RADIUS.ribbon, b.lane, b.angle).depth; })
        .forEach(function (r) {
          if (r.start > upTo) return;
          var end = Math.min(r.end, upTo);
          var o = offsetOf(RADIUS.ribbon, r.lane, r.angle);
          var x0 = slotX(r.start), x1 = slotX(end);
          var behind = o.depth < 0;
          var sel = r.id === selectedId;
          ctx.globalAlpha = behind ? 0.35 : 1;
          ctx.strokeStyle = sel ? GOLD : (r.open ? PLANT_COLOR : STRUCTURE_COLOR);
          ctx.lineWidth = lw(sel ? 3 : 1.6);
          ctx.beginPath();
          ctx.moveTo(x0, SPINE_Y);
          ctx.bezierCurveTo(x0 + SLOT * 0.3, o.y, x1 - SLOT * 0.3, o.y, x1, r.open ? o.y : SPINE_Y);
          ctx.stroke();
          if (r.open) {
            ctx.lineWidth = lw(3);
            ctx.beginPath();
            ctx.moveTo(x1, o.y - lw(9)); ctx.lineTo(x1, o.y + lw(9));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        });
    }

    // Characters. A continuous ghost line across the span with beads where something was
    // actually logged -- the line says the character exists across that stretch, the beads
    // say only where a moment records them. A gap is an unrecorded stretch, never a claim
    // that anybody left.
    if (show.strands) {
      spine.strands.forEach(function (s) {
        if (s.start > upTo) return;
        var o = offsetOf(RADIUS.strand, s.lane, s.angle);
        var sel = s.id === selectedId;
        ctx.globalAlpha = o.depth < 0 ? 0.3 : 0.75;
        ctx.strokeStyle = sel ? GOLD : '#4a5a55';
        ctx.lineWidth = lw(sel ? 2.5 : 1);
        ctx.setLineDash([lw(3), lw(4)]);
        ctx.beginPath();
        ctx.moveTo(slotX(s.start), o.y); ctx.lineTo(slotX(Math.min(s.end, upTo)), o.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = o.depth < 0 ? 0.4 : 1;
        ctx.fillStyle = sel ? GOLD : '#8fa39c';
        s.beads.forEach(function (b) {
          if (b.ord > upTo) return;
          ctx.beginPath();
          ctx.arc(slotX(b.ord), o.y, lw(b.isPov ? 5 : 3.2), 0, Math.PI * 2);
          ctx.fill();
        });
        if (t === 'detail') {
          ctx.fillStyle = '#7f8fa0';
          ctx.font = lw(10) + 'px system-ui';
          ctx.textAlign = 'right';
          ctx.fillText(s.label, slotX(s.start) - lw(8), o.y + lw(3));
        }
        ctx.globalAlpha = 1;
      });
    }

    // Stems, then the nodes on the axis.
    ctx.lineWidth = lw(1);
    ctx.strokeStyle = 'rgba(107,95,138,0.28)';
    nodes.forEach(function (n) {
      if (n.kind === 'chapter' || n.unanchored || !visible(n)) return;
      ctx.beginPath();
      ctx.moveTo(slotX(n.ord), SPINE_Y); ctx.lineTo(n.x, n.y);
      ctx.stroke();
    });

    nodes.forEach(function (n) {
      if (!visible(n)) return;
      shape(ctx, n.kind, n.x, n.y, n.r);
      if (n.unanchored) {
        ctx.strokeStyle = colorOf(n); ctx.lineWidth = lw(1.5);
        ctx.setLineDash([lw(4), lw(3)]); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = colorOf(n); ctx.fill();
      }

      if (show.health && healthBySubject[n.id]) {
        ctx.strokeStyle = GOLD; ctx.lineWidth = lw(2);
        ctx.beginPath();
        ctx.moveTo(n.x - n.r, n.y + n.r * 1.7); ctx.lineTo(n.x + n.r, n.y + n.r * 1.7);
        ctx.stroke();
      }
      if (n.id === selectedId) {
        ctx.strokeStyle = GOLD; ctx.lineWidth = lw(2.5);
        shape(ctx, n.kind, n.x, n.y, n.r + lw(4)); ctx.stroke();
      }
      if (n.kind === 'chapter') {
        ctx.fillStyle = '#0d1110'; ctx.font = 'bold ' + lw(11) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n.ord), n.x, n.y);
        if (t === 'detail') {
          ctx.fillStyle = '#cfd8d5'; ctx.font = lw(10) + 'px system-ui';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(clip(n.label, 22), n.x, n.y - lw(24));
        }
        ctx.textBaseline = 'alphabetic';
      }
    });
    ctx.textAlign = 'left';
    hud();
  }

  function hud() {
    document.getElementById('count').textContent =
      slots + ' chapters · ' + raw.flags.length + ' flagged · ' +
      spine.openCounts.groupings + ' still open · ' + spine.ribbons.length + ' subplots';
    document.getElementById('uptoLabel').textContent = 'ch ' + upTo;
  }

  function clip(s, n) {
    s = String(s === null || s === undefined ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  // ---- interaction ----------------------------------------------------------------
  //
  // Pan along the axis, orbit about it, zoom. No roll, and the axis keeps a fixed screen
  // direction: it encodes the order the saga is read in, and an axis that can be turned
  // to face the viewer can be collapsed to a dot.
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, cam: cam, moved: false, orbit: e.shiftKey };
    cv.setPointerCapture(e.pointerId); cv.className = 'drag';
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.orbit && roundness > 0) { cam = drag.cam + dy * 0.01; }
    else { view.x = drag.vx + dx; view.y = drag.vy + dy; }
    draw();
  });
  cv.addEventListener('pointerup', function (e) {
    var wasDrag = drag && drag.moved;
    drag = null; cv.className = '';
    if (!wasDrag) pick(e.clientX, e.clientY);
  });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var k = Math.max(0.08, Math.min(4, view.k * (e.deltaY < 0 ? 1.12 : 0.89)));
    var wx = (e.clientX - view.x) / view.k, wy = (e.clientY - view.y) / view.k;
    view.k = k; view.x = e.clientX - wx * k; view.y = e.clientY - wy * k;
    draw();
  }, { passive: false });

  function pick(cx, cy) {
    var wx = (cx - view.x) / view.k, wy = (cy - view.y) / view.k;
    var hit = null, best = Infinity;
    nodes.forEach(function (n) {
      if (!visible(n)) return;
      var d = Math.sqrt((n.x - wx) * (n.x - wx) + (n.y - wy) * (n.y - wy));
      if (d < n.r + 8 && d < best) { best = d; hit = n; }
    });
    if (!hit && show.ribbons) {
      spine.ribbons.forEach(function (r) {
        if (r.start > upTo) return;
        var o = offsetOf(RADIUS.ribbon, r.lane, r.angle);
        if (wx < slotX(r.start) - 20 || wx > slotX(Math.min(r.end, upTo)) + 20) return;
        if (Math.abs(wy - o.y) < 14 && Math.abs(wy - o.y) < best) { best = Math.abs(wy - o.y); hit = r; }
      });
    }
    if (!hit && show.strands) {
      spine.strands.forEach(function (s) {
        if (s.start > upTo) return;
        var o = offsetOf(RADIUS.strand, s.lane, s.angle);
        if (wx < slotX(s.start) - 20 || wx > slotX(Math.min(s.end, upTo)) + 20) return;
        if (Math.abs(wy - o.y) < 12 && Math.abs(wy - o.y) < best) { best = Math.abs(wy - o.y); hit = s; }
      });
    }
    select(hit ? hit.id : null);
  }

  function esc(s) {
    return String(s === null || s === undefined || s === '' ? '—' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function row(k, v) { return '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>'; }

  function select(id) {
    selectedId = id;
    var box = document.getElementById('focus');
    if (!id) { box.className = ''; draw(); return; }

    var item = byId[id], html = '';
    var isRibbon = spine.ribbons.indexOf(item) !== -1;
    var isStrand = spine.strands.indexOf(item) !== -1;

    if (isRibbon) {
      html += '<h2>' + esc(item.label) + '</h2><dl>';
      html += row('a subplot', item.plants.length + ' planted, ' + item.reveals.length + ' revealed');
      html += row('opens at chapter', item.start);
      html += row(item.open ? 'still open' : 'resolves at chapter', item.open ? 'nothing claims it yet' : item.end);
    } else if (isStrand) {
      html += '<h2>' + esc(item.label) + '</h2><dl>';
      html += row('first seen', 'chapter ' + item.start);
      html += row('last seen', 'chapter ' + item.end);
      html += row('appears in', item.beads.length + ' of ' + slots + ' chapters');
      html += row('gaps mean', 'no moment recorded there — not that they are absent');
    } else {
      var d = item.data;
      html += '<h2>' + esc(item.label) + '</h2><dl>';
      html += row('position in the saga', item.ord ? 'chapter ' + item.ord + ' of ' + slots : 'not placed in a chapter');
      if (item.kind === 'chapter') {
        html += row('book and act', 'Book ' + (d.book + 1) + ' · Act ' + d.act);
        html += row('words', d.words);
        html += row('scenes', (scenesByChapter[d.id] || []).length);
      } else if (item.kind === 'scene') {
        html += row('in chapter', clip((chapterById[d.chapterId] || {}).title, 40));
        html += row('told by', d.pov);
        html += row('summary', clip(d.summary, 180));
      } else if (item.kind === 'event') {
        html += row('people present', d.participants);
        html += row('told by', (d.properties || {}).pov);
      } else {
        html += row('attached to', d.sceneId ? 'a scene' : 'the whole chapter');
        html += row('subplots', (d.pairs || []).map(function (p) { return p.label || p.id; }).join(', '));
        if (item.kind === 'thread') html += row('thread', d.thread);
        html += row('the line', clip(d.text, 220));
      }
    }
    html += '</dl>';

    var signals = healthBySubject[id] || [];
    if (signals.length) {
      html += '<div class="warn">' + signals.map(function (s) { return esc(s.text); }).join('<br>') + '</div>';
      html += '<p><button id="dismiss" data-subject="' + esc(id) + '">This one is deliberate</button></p>';
    }

    document.getElementById('body').innerHTML = html;
    var btn = document.getElementById('dismiss');
    if (btn) btn.addEventListener('click', function () {
      dismissAnnotation(this.getAttribute('data-subject'));
      recompute();
      select(selectedId);
    });
    box.className = 'open';
    draw();
  }

  function fit() {
    var xs = nodes.filter(function (n) { return inTime(n.ord); });
    if (!xs.length) return;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    xs.forEach(function (n) {
      x0 = Math.min(x0, n.x - n.r); x1 = Math.max(x1, n.x + n.r);
      y0 = Math.min(y0, n.y - n.r); y1 = Math.max(y1, n.y + n.r);
    });
    if (show.ribbons) { y1 = Math.max(y1, RIBBON_BASE + spine.laneCounts.ribbon * RIBBON_GAP); }
    if (show.strands) { y0 = Math.min(y0, -(STRAND_BASE + spine.laneCounts.strand * STRAND_GAP)); }
    var pad = 60, w = cv.clientWidth - pad * 2, h = cv.clientHeight - pad * 2;
    var k = Math.min(w / (x1 - x0), h / (y1 - y0));

    // Fitting the whole bounding box is wrong here, and looking at it is what showed that.
    // With 21 subplot lanes the flat layout is ~800px tall, so fitting it vertically drove
    // the zoom below the far-view threshold: the opening screen drew three act bands and
    // nothing else, on a project with 17 chapters and 79 flags in it. A view that opens
    // showing none of its own content is not a fit.
    //
    // So the zoom never goes below the detail threshold. If the content will not fit at
    // that zoom -- which is the 21-lane problem, not a framing problem -- the spine is
    // anchored to the top-left and the rest is reachable by panning.
    var floor = LOD.structure + 0.05;
    if (k < floor) {
      view.k = floor;
      view.x = pad - x0 * view.k;
      view.y = pad - (SPINE_Y - 120) * view.k;
    } else {
      view.k = Math.min(4, k);
      view.x = pad - x0 * view.k + (w - (x1 - x0) * view.k) / 2;
      view.y = pad - y0 * view.k + (h - (y1 - y0) * view.k) / 2;
    }
    draw();
  }

  // The unroll is animated as an unroll. The seam -- where the highest slot meets the
  // first -- is fixed at the back of the cylinder by the angle allocation, so it opens
  // behind the camera instead of tearing across the middle of the picture.
  function animateRoundness(to) {
    var from = roundness, t0 = performance.now(), ms = 420;
    (function step(now) {
      var p = Math.min(1, (now - t0) / ms);
      roundness = from + (to - from) * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      draw();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // Every hidden thing is reachable by one plainly-worded control. No settings page, no
  // mode picker, no second code path -- the same layers with visible set false.
  function wire(id, key, after) {
    var el = document.getElementById(id);
    el.className = 'chip' + (show[key] ? ' on' : '');
    el.addEventListener('click', function () {
      show[key] = !show[key];
      this.className = 'chip' + (show[key] ? ' on' : '');
      if (after) after(show[key]);
      draw();
    });
  }
  show.scene = show.scene !== false;
  show.flags = show.flags !== false;
  show.moment = show.moment === true;
  wire('t-scene', 'scene');
  wire('t-flag', 'flags');
  wire('t-ribbon', 'ribbons');
  wire('t-strand', 'strands');
  wire('t-moment', 'moment');
  wire('t-health', 'health');
  wire('t-round', 'round', function (on) { animateRoundness(on ? 1 : 0); });

  var slider = document.getElementById('upto');
  slider.max = String(slots); slider.value = String(slots);
  slider.addEventListener('input', function () { upTo = +this.value; draw(); });

  document.getElementById('fit').addEventListener('click', fit);
  document.getElementById('close').addEventListener('click', function () { select(null); });

  // Inspection handle. Not a debug leftover: the claim of this layout is that positions
  // are computed rather than settled into, and that is only checkable from outside if the
  // computed positions are reachable.
  window.__SPINE__ = { spine: spine, nodes: nodes, view: view, pendingWrites: pendingWrites,
                       setUpTo: function (v) { upTo = v; draw(); },
                       setRound: function (v) { roundness = v; draw(); },
                       tier: tier, offsetOf: offsetOf };

  function resize() {
    cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; draw();
  }
  window.addEventListener('resize', resize);
  resize();
  fit();
})();
</script>
`;

if (HTML.indexOf('`') !== -1) throw new Error('unexpected backtick in the prototype markup');

const out = HTML
  .replace('/*__PAYLOAD__*/', 'window.__GRAPH__ = ' + JSON.stringify(payload) + ';')
  .replace('/*__LAYOUT__*/', layout);

const banner =
  '<!-- GENERATED FILE - do not edit by hand.\n' +
  '     Geometry from graph/spine-layout.mjs, data from graph/character-web-demo.html.\n' +
  '     Rebuild with: node scripts/build-spine-prototype.mjs -->\n';

const OUT = useLocal ? OUT_LOCAL : OUT_DEMO;
fs.writeFileSync(OUT, banner + out, 'utf8');
console.log(
  path.relative(ROOT, OUT).replace(/\\/g, '/') + '  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB  ' +
    payload.chapters.length + ' chapters, ' + payload.flags.length + ' flags',
);
