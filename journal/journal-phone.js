/* journal-phone.js -- the phone's half of a journal page, around journal-kit.js inside a WebView.
   Inlined with the kit by scripts/build-journal-html.mjs into mobile/src/lib/journalHtml.ts.

   The page, its editing and the scanner are the kit's, unchanged. This file adds what the studio
   draws around them in its own window -- the bar under the page and the palette -- and the
   message bridge to the app, which holds the data and does every save and upload.

   From the app:  page {page} · library {uploads, cast, notes, scenes, docs} · add {fields}
                  patch {itemId, fields} · url {rid, url} · scan {src, spread} · deselect
   To the app:    ready · url {rid, bucket, path} · changed {items} · editText {item}
                  pickDocument {id} · uploadPictures · scanned {parts} · scanCancel */
(function () {
  'use strict';
  const JK = window.JournalKit;
  const $ = (s) => document.querySelector(s);
  const esc = JK.esc;
  let page = null, selected = null, lib = { uploads: [], cast: [], notes: [], scenes: [], docs: [] };
  let palTab = 'kit', query = '';

  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const waiting = new Map(); let rid = 0; const urls = new Map();
  function urlFor(bucket, path) {
    const k = bucket + ':' + path;
    if (urls.has(k)) return Promise.resolve(urls.get(k));
    return new Promise((resolve) => { const id = ++rid; waiting.set(id, (u) => { if (u) urls.set(k, u); resolve(u); }); post({ type: 'url', rid: id, bucket, path }); });
  }

  const desk = $('#desk'), sheet = $('#sheet'), frame = $('#frame');
  function fit() {
    const s = Math.min((desk.clientWidth - 16) / JK.JW, (desk.clientHeight - 16) / JK.JH);
    frame.style.width = JK.JW * s + 'px'; frame.style.height = JK.JH * s + 'px';
    sheet.style.transform = 'scale(' + s + ')';
  }
  function draw() {
    if (!page) return;
    JK.renderSheet(sheet, page, { selectedId: selected, urlFor });
    fit(); drawBar();
  }
  const changed = () => post({ type: 'changed', items: page.items });
  const sel = () => (page && selected ? page.items.find((x) => x.id === selected) : null);
  const topZ = () => Math.max(0, ...page.items.map((i) => i.z || 0)) + 1;

  JK.attach(desk, {
    pageOf: (id) => (page && page.id === id ? page : null),
    selected: () => (selected ? { page: page.id, item: selected } : null),
    onSelect: (_p, itemId) => { selected = itemId; draw(); },
    onChange: () => { draw(); changed(); },
    onTyping: changed,
    onEditText: (_p, itemId) => { const it = page.items.find((x) => x.id === itemId); if (it) post({ type: 'editText', item: it }); },
  });
  // On the phone, writing happens in the app's own text sheet (the system keyboard, the whole
  // screen): a double tap on anything with words asks for it, before the kit's in-place editing.
  desk.addEventListener('dblclick', (ev) => {
    const el = ev.target.closest('.jk-item'); if (!el || !page) return;
    ev.stopPropagation();
    const it = page.items.find((x) => x.id === el.dataset.item);
    if (it && ['text', 'stamp', 'cutout'].includes(it.kind)) post({ type: 'editText', item: it });
  }, true);

  // ---- the bar under the page --------------------------------------------------------------
  function drawBar() {
    const bar = $('#bar'); const it = sel();
    if (!page) { bar.innerHTML = ''; return; }
    if (!it) {
      bar.innerHTML = '<button class="go" data-act="palette">+ Add to the page</button>' +
        '<span class="hint">' + (page.scan_path ? 'A scanned page — add to it, the page itself stays as written.' : 'Tap a thing to move it; two fingers turn and size it; double-tap words to write.') + '</span>';
      return;
    }
    const colors = it.kind === 'tape' ? JK.KIT.tapeColors : JK.KIT.inks;
    const choose = (k, opts, cur) => '<span class="cyc" data-k="' + k + '">' + esc((opts.find((o) => o[0] === cur) || opts[0])[1]) + ' ▾</span>';
    bar.innerHTML = '<div class="tools">' +
      (['text', 'stamp', 'tape'].includes(it.kind) ? colors.map((c) => '<button class="sw' + (it.color === c ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>').join('') : '') +
      (['text', 'stamp', 'cutout'].includes(it.kind) ? '<button data-act="write">Words</button>' : '') +
      (it.kind === 'text' ? choose('font', Object.entries(JK.KIT.fonts).map(([k, [, l]]) => [k, l]), it.font) + '<button data-act="smaller">A−</button><button data-act="bigger">A+</button>' : '') +
      (it.kind === 'tape' ? choose('pattern', JK.KIT.tapePatterns.map((p) => [p, p]), it.pattern) : '') +
      (it.kind === 'image' ? choose('edge', [['deckle', 'deckle'], ['torn', 'torn'], ['straight', 'straight']], it.edge) : '') +
      '<button data-act="front">⬆</button><button data-act="back">⬇</button><button data-act="dup">⧉</button><button class="del" data-act="del">✕</button>' +
      '<button data-act="done">Done</button></div>';
  }
  $('#bar').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act],[data-color],[data-k]'); if (!b || !page) return;
    const act = b.dataset.act;
    if (act === 'palette') return openPalette(true);
    const it = sel(); if (!it) return;
    if (b.dataset.color) it.color = b.dataset.color;
    if (b.dataset.k) {
      const k = b.dataset.k;
      const opts = k === 'font' ? Object.keys(JK.KIT.fonts) : k === 'pattern' ? JK.KIT.tapePatterns : ['deckle', 'torn', 'straight'];
      it[k] = opts[(opts.indexOf(it[k]) + 1) % opts.length];
    }
    if (act === 'write') return post({ type: 'editText', item: it });
    if (act === 'done') { selected = null; return draw(); }
    if (act === 'bigger') it.size = Math.round((it.size || 30) * 1.15);
    if (act === 'smaller') it.size = Math.max(10, Math.round((it.size || 30) / 1.15));
    if (act === 'front') it.z = topZ();
    if (act === 'back') it.z = Math.min(0, ...page.items.map((i) => i.z || 0)) - 1;
    if (act === 'dup') { const c = Object.assign({}, it, { id: JK.uid(), x: it.x + 18, y: it.y + 18, z: topZ() }); page.items.push(c); selected = c.id; }
    if (act === 'del') { page.items = page.items.filter((i) => i !== it); selected = null; }
    draw(); changed();
  });

  function add(fields, thenWrite) {
    if (!page) return;
    const it = JK.newItem(page, fields);
    page.items.push(it); selected = it.id;
    openPalette(false); draw(); changed();
    if (thenWrite) post({ type: 'editText', item: it });
  }

  // ---- the palette: the kit, the writer's own pictures, the project ----------------------------
  function openPalette(open) { $('#pal').classList.toggle('open', open); if (open) drawPalette(); }
  function drawPalette() {
    const tabs = [['kit', 'Kit'], ['mine', 'Mine'], ['project', 'Project']];
    let body = '';
    if (palTab === 'kit') {
      body = '<h4>Write</h4><div class="row">' + Object.entries(JK.KIT.fonts).map(([k, [family, label]]) => '<button class="p-text" data-add="text" data-font="' + k + '" style="font-family:' + family + '">' + label + '</button>').join('') + '</div>' +
        '<h4>Washi tape</h4><div class="tapes">' + JK.KIT.tapePatterns.flatMap((p, pi) => JK.KIT.tapeColors.filter((_, ci) => (ci + pi) % 2 === 0).slice(0, 4).map((c) => '<button class="p-tape" data-add="tape" data-pattern="' + p + '" data-color="' + c + '" style="' + JK.tapeStyle({ pattern: p, color: c }) + '"></button>')).join('') + '</div>' +
        '<h4>Stamps</h4><div class="row">' +
        '<button class="p-stamp date" data-add="stamp" data-shape="date" style="color:#7a2e24;border-color:#7a2e24">' + esc(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }).toUpperCase()) + '</button>' +
        '<button class="p-stamp letters" data-add="stamp" data-shape="letters" style="color:#2b2118">' + JK.stampLetters('abc') + '</button>' +
        JK.KIT.stampWords.map((w, i) => { const c = JK.KIT.inks[(i + 2) % JK.KIT.inks.length]; const shape = i % 3 === 1 ? 'circle' : 'box'; return '<button class="p-stamp ' + shape + '" data-add="stamp" data-shape="' + shape + '" data-text="' + esc(w) + '" data-color="' + c + '" style="color:' + c + ';border-color:' + c + '">' + esc(w) + '</button>'; }).join('') + '</div>' +
        '<h4>Stickers</h4><div class="stickers">' + Object.keys(JK.KIT.stickers).map((n) => '<button class="p-sticker" data-add="sticker" data-name="' + n + '">' + JK.stickerSvg(n) + '</button>').join('') + '</div>';
    } else if (palTab === 'mine') {
      body = '<button class="go wide" data-act="upload">Add pictures from the phone…</button>' +
        '<p class="hint">Photographs, scraps, stickers — a PNG keeps its transparent background.</p>' +
        '<div class="imgs">' + (lib.uploads.map((p) => '<button class="p-img" data-add="upload" data-path="' + esc(p) + '"><img data-bucket="journal-images" data-path="' + esc(p) + '" alt=""></button>').join('') || '<p class="hint">Nothing added yet.</p>') + '</div>';
    } else {
      const q = query.toLowerCase(); const has = (t) => !q || String(t || '').toLowerCase().includes(q);
      const list = (rows, kind, label) => rows.map((r) => '<button data-add="' + kind + '" data-id="' + esc(r.id) + '">' + label(r) + '</button>').join('') || '<p class="hint">None.</p>';
      body = '<input id="pq" placeholder="Find in the project…" value="' + esc(query) + '">' +
        '<h4>Characters</h4><div class="list">' + list(lib.cast.filter((c) => has(c.name)), 'character', (c) => '<span class="dot" style="background:' + esc(c.color) + '"></span>' + esc(c.name) + (c.image_path ? ' · picture' : '')) + '</div>' +
        '<h4>Storyboard notes</h4><div class="list">' + list(lib.notes.filter((e) => has(e.title) || has(e.summary)).slice(0, 40), 'note', (e) => esc(e.book) + ' · ' + esc(e.title || 'Untitled')) + '</div>' +
        '<h4>Scenes</h4><div class="list">' + list(lib.scenes.filter((t) => has(t.title)).slice(0, 40), 'scene', (t) => esc(t.title)) + '</div>' +
        '<h4>Documents</h4><div class="list">' + list(lib.docs.filter((d) => has(d.title)).slice(0, 40), 'document', (d) => esc(d.title)) + '</div>';
    }
    const pal = $('#pal-body');
    $('#pal-tabs').innerHTML = tabs.map(([k, l]) => '<button class="' + (palTab === k ? 'on' : '') + '" data-tab="' + k + '">' + l + '</button>').join('') + '<span class="sp"></span><button data-act="close">✕</button>';
    pal.innerHTML = body;
    pal.querySelectorAll('img[data-path]').forEach(async (img) => { const u = await urlFor(img.dataset.bucket, img.dataset.path); if (u) img.src = u; });
    const qe = $('#pq'); if (qe) qe.oninput = () => { query = qe.value; clearTimeout(drawPalette.t); drawPalette.t = setTimeout(() => { drawPalette(); const n = $('#pq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  }
  $('#pal-tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'close') return openPalette(false);
    palTab = b.dataset.tab; drawPalette();
  });
  $('#pal-body').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-add],[data-act]'); if (!b) return;
    const d = b.dataset;
    if (d.act === 'upload') return post({ type: 'uploadPictures' });
    if (d.add === 'text') return add({ kind: 'text', text: '', font: d.font, size: d.font === 'hand' ? 34 : 24, color: '#2b2118', align: 'left', w: 300, h: 120 }, true);
    if (d.add === 'tape') return add({ kind: 'tape', pattern: d.pattern, color: d.color, w: 170, h: 34 });
    if (d.add === 'stamp') {
      if (d.shape === 'date') return add({ kind: 'stamp', shape: 'date', text: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(), color: '#7a2e24', w: 190, h: 54 });
      if (d.shape === 'letters') return add({ kind: 'stamp', shape: 'letters', text: 'word', color: '#2b2118', w: 146, h: 46 }, true);
      return add({ kind: 'stamp', shape: d.shape, text: d.text, color: d.color, w: d.shape === 'circle' ? 110 : 150, h: d.shape === 'circle' ? 110 : 48 });
    }
    if (d.add === 'sticker') return add({ kind: 'sticker', name: d.name, w: 90, h: 90 });
    if (d.add === 'upload') return add({ kind: 'image', bucket: 'journal-images', path: d.path, edge: 'deckle', w: 240, h: 240 });
    if (d.add === 'character') {
      const c = lib.cast.find((x) => x.id === d.id); if (!c) return;
      if (c.image_path) return add({ kind: 'image', bucket: 'character-images', path: c.image_path, edge: 'deckle', w: 200, h: 270 });
      return add({ kind: 'cutout', source: 'character', ref: c.id, title: c.name, text: c.description || '', paper: 'tag', w: 220, h: 130 });
    }
    if (d.add === 'note') { const e = lib.notes.find((x) => x.id === d.id); if (e) add({ kind: 'cutout', source: 'note', ref: e.id, title: e.title || 'Untitled', text: e.summary || '', paper: 'newsprint', w: 240, h: 190 }); return; }
    if (d.add === 'scene') { const t = lib.scenes.find((x) => x.id === d.id); if (t) add({ kind: 'cutout', source: 'scene', ref: t.id, title: t.title, text: t.text, paper: 'lined', w: 260, h: 220 }); return; }
    // A document's text is not in the listing; the app fetches it and sends the cutout back.
    if (d.add === 'document') { openPalette(false); return post({ type: 'pickDocument', id: d.id }); }
  });

  // ---- messages from the app -----------------------------------------------------------------
  function receive(raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.type === 'page') { const same = page && page.id === m.page.id; page = m.page; if (!same) selected = null; draw(); }
    else if (m.type === 'library') { lib = Object.assign(lib, m.library); if ($('#pal').classList.contains('open')) drawPalette(); }
    else if (m.type === 'add') add(m.fields, m.thenWrite);
    else if (m.type === 'patch') { const it = page && page.items.find((x) => x.id === m.itemId); if (it) { Object.assign(it, m.fields); draw(); changed(); } }
    else if (m.type === 'url') { const f = waiting.get(m.rid); waiting.delete(m.rid); if (f) f(m.url); }
    else if (m.type === 'deselect') { selected = null; openPalette(false); draw(); }
    else if (m.type === 'scan') {
      const host = $('#scanner'); host.hidden = false;
      JK.openScanner(host, m.src, {
        spread: !!m.spread,
        onDone: (parts) => { host.hidden = true; host.innerHTML = ''; post({ type: 'scanned', parts }); },
        onCancel: () => { host.hidden = true; host.innerHTML = ''; post({ type: 'scanCancel' }); },
      }).catch(() => { host.hidden = true; post({ type: 'scanCancel', error: 'That picture could not be opened.' }); });
    }
  }
  window.addEventListener('message', (e) => receive(e.data));
  document.addEventListener('message', (e) => receive(e.data)); // Android delivers here
  window.addEventListener('resize', () => page && fit());
  post({ type: 'ready' });
})();
