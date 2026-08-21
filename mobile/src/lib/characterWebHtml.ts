// The character web itself: one self-contained document, rendered by 3d-force-graph.
//
// Kept as a string rather than a bundled .html asset because React Native cannot require
// HTML, and because this is the canonical copy -- the PWA should serve this same markup
// rather than growing a second implementation (spec §6). Data arrives by postMessage on
// mobile and can be assigned to window.__GRAPH__ directly when embedded elsewhere.
//
// DEVIATION (spec §9.5, WebView performance): the renderer starts in 3D but falls back to
// 2D automatically when the graph is dense enough that a mid-range phone would struggle,
// and the reader can switch modes by hand at any time. The spec asks not to pre-optimise,
// and this does not -- 3D remains the default and the full experience. It only avoids the
// one outcome the spec names as worse than 2D: a laggy 3D graph.
export const CHARACTER_WEB_HTML = String.raw`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0d1110; }
  #graph { width: 100vw; height: 100vh; }
  #empty, #error {
    position: absolute; inset: 0; display: none;
    align-items: center; justify-content: center; text-align: center;
    padding: 32px; color: #8d9a97;
    font: 14px/1.6 -apple-system, system-ui, sans-serif;
  }
  #hud {
    position: absolute; left: 12px; top: 12px; right: 12px;
    display: flex; gap: 8px; align-items: flex-start; pointer-events: none;
  }
  .chip {
    pointer-events: auto;
    background: rgba(15,20,19,0.82); border: 1px solid #2c3634; color: #d8e0de;
    border-radius: 14px; padding: 6px 11px;
    font: 11px/1 -apple-system, system-ui, sans-serif; letter-spacing: .03em;
  }
  .chip:active { background: rgba(198,154,58,0.24); }
  #focus {
    position: absolute; left: 12px; right: 12px; bottom: 12px;
    background: rgba(15,20,19,0.9); border: 1px solid #2c3634; border-radius: 8px;
    padding: 12px 14px; color: #e6ecea; display: none;
    font: 13px/1.5 -apple-system, system-ui, sans-serif;
  }
  #focus h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
  #focus .row { color: #96a3a0; font-size: 12px; }
  #focus .legend { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  #focus .legend span { font-size: 10.5px; padding: 2px 7px; border-radius: 10px; background: #1b2321; }
</style>
</head>
<body>
<div id="graph"></div>
<div id="empty">No character interactions extracted yet.<br>Write, or run an extraction pass, and they will appear here.</div>
<div id="error">Could not load the graph renderer.<br>This view needs a network connection the first time.</div>
<div id="hud">
  <div class="chip" id="toggle-dim">2D</div>
  <div class="chip" id="reset">Reset</div>
  <div class="chip" id="count"></div>
</div>
<div id="focus"></div>

<script src="https://cdn.jsdelivr.net/npm/3d-force-graph@1/dist/3d-force-graph.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/force-graph@1/dist/force-graph.min.js"></script>
<script>
(function () {
  var data = window.__GRAPH__ || { nodes: [], links: [] };
  var mode = '3d';
  var graph = null;
  var selected = null;

  // Fixed palette so a colour means the same thing every session (spec §5.2).
  var TYPE_COLOR = {
    confrontation: '#e0764a',
    alliance:      '#6fae74',
    betrayal:      '#c0504d',
    mentorship:    '#5b9bd5',
    romantic:      '#c47ab5',
    other:         '#8d9a97'
  };
  var DIM = 'rgba(120,132,129,0.10)';

  function neighbours(id) {
    var set = { nodes: {}, links: {} };
    set.nodes[id] = true;
    data.links.forEach(function (l, i) {
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === id || t === id) { set.links[i] = true; set.nodes[s] = true; set.nodes[t] = true; }
    });
    return set;
  }

  function nodeColor(n) {
    if (!selected) return n.needsReview ? '#c69a3a' : '#cfd8d5';
    return selected.nodes[n.id] ? (n.id === selected.id ? '#f2c94c' : '#cfd8d5') : DIM;
  }

  function linkColor(l, i) {
    var base = TYPE_COLOR[l.type] || TYPE_COLOR.other;
    if (!selected) return base;
    return selected.links[i] ? base : DIM;
  }

  function showFocus(n) {
    var box = document.getElementById('focus');
    if (!n) { box.style.display = 'none'; return; }
    var partners = data.links.filter(function (l) {
      var s = typeof l.source === 'object' ? l.source.id : l.source;
      var t = typeof l.target === 'object' ? l.target.id : l.target;
      return s === n.id || t === n.id;
    });
    var kinds = {};
    partners.forEach(function (l) { kinds[l.type || 'other'] = (kinds[l.type || 'other'] || 0) + (l.count || 1); });
    box.innerHTML =
      '<h3>' + esc(n.label) + '</h3>' +
      '<div class="row">' + partners.length + ' connection' + (partners.length === 1 ? '' : 's') +
      ' · ' + (n.degree || 0) + ' edges total</div>' +
      '<div class="legend">' + Object.keys(kinds).map(function (k) {
        return '<span style="color:' + (TYPE_COLOR[k] || TYPE_COLOR.other) + '">' + k + ' ×' + kinds[k] + '</span>';
      }).join('') + '</div>';
    box.style.display = 'block';
    post({ type: 'select', id: n.id, label: n.label });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
  }); }

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function build() {
    var el = document.getElementById('graph');
    el.innerHTML = '';
    var factory = mode === '3d' ? window.ForceGraph3D : window.ForceGraph;
    if (!factory) { document.getElementById('error').style.display = 'flex'; return; }

    graph = factory()(el)
      .graphData(data)
      .backgroundColor('#0d1110')
      .nodeLabel('label')
      .nodeVal(function (n) { return 1 + (n.degree || 0); })
      .nodeColor(nodeColor)
      .linkColor(linkColor)
      .linkWidth(function (l) { return selected ? (isSel(l) ? 2.4 : 0.4) : Math.min(4, 0.6 + (l.count || 1) * 0.4); })
      .onNodeClick(function (n) {
        selected = neighbours(n.id);
        selected.id = n.id;
        refresh();
        showFocus(n);
        if (mode === '3d' && graph.cameraPosition) {
          var d = 120;
          var r = Math.hypot(n.x || 0, n.y || 0, n.z || 0) || 1;
          graph.cameraPosition(
            { x: (n.x || 0) * (1 + d / r), y: (n.y || 0) * (1 + d / r), z: (n.z || 0) * (1 + d / r) },
            n, 900
          );
        }
      })
      .onBackgroundClick(reset);

    if (mode === '3d') {
      // Directional particles carry the "firing" read the spec asks for, and only on the
      // highlighted edges so an unfiltered graph stays calm.
      graph.linkDirectionalParticles(function (l) { return selected && isSel(l) ? 3 : 0; })
           .linkDirectionalParticleWidth(2.2)
           .linkDirectionalParticleSpeed(0.012);
    }

    document.getElementById('toggle-dim').textContent = mode === '3d' ? '2D' : '3D';
  }

  function isSel(l) {
    if (!selected) return false;
    var i = data.links.indexOf(l);
    return selected.links[i];
  }

  function refresh() {
    if (!graph) return;
    graph.nodeColor(nodeColor).linkColor(linkColor)
         .linkWidth(function (l) { return selected ? (isSel(l) ? 2.4 : 0.4) : Math.min(4, 0.6 + (l.count || 1) * 0.4); });
    if (mode === '3d' && graph.linkDirectionalParticles) {
      graph.linkDirectionalParticles(function (l) { return selected && isSel(l) ? 3 : 0; });
    }
  }

  function reset() {
    selected = null;
    refresh();
    showFocus(null);
    post({ type: 'select', id: null });
  }

  function start() {
    document.getElementById('count').textContent =
      data.nodes.length + ' characters · ' + data.links.length + ' links';

    if (data.nodes.length === 0) {
      document.getElementById('empty').style.display = 'flex';
      return;
    }
    // Density check, not a device check: past this size a phone GPU spends more time on
    // the 3D scene than the reader gains from it.
    if (data.nodes.length > 90 || data.links.length > 260) mode = '2d';
    build();
  }

  document.getElementById('toggle-dim').addEventListener('click', function () {
    mode = mode === '3d' ? '2d' : '3d';
    selected = null;
    showFocus(null);
    build();
  });
  document.getElementById('reset').addEventListener('click', reset);

  // Data can arrive after load (mobile posts it in).
  window.addEventListener('message', function (e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'data') { data = msg.payload; selected = null; showFocus(null); start(); }
    } catch (err) {}
  });
  document.addEventListener('message', function (e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'data') { data = msg.payload; selected = null; showFocus(null); start(); }
    } catch (err) {}
  });

  if (window.__GRAPH__) start(); else post({ type: 'ready' });
})();
</script>
</body>
</html>`;
