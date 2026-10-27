/* journal-kit.js -- the writing journal's page: how it is drawn, how it is edited, and how a
   photograph of a real notebook page becomes one (2026-10-27).

   ONE SOURCE FOR BOTH APPS. studio.html loads this file with <script src>; the phone runs it in
   a WebView, inlined by scripts/build-journal-html.mjs into mobile/src/lib/journalHtml.ts. It
   knows nothing about Supabase or either app's state: the host hands pages in, is told about
   changes, and does the saving. So a page looks and behaves the same in both apps by
   construction, not by two copies being kept alike.

   A page is { id, day, title, paper, scan_path, items[] } in page units, 600 x 840. An item is
   { id, kind, x, y, w, h, r, z, ...props } -- see supabase/migrations/20261027_journal.sql.

   SCANNING CAPTURES, IT DOES NOT CORRECT. The scanner straightens the page (four corners, a
   perspective warp), rotates it, crops it, and splits a two-page spread. It does not recognise
   text, does not clean up handwriting, and leaves the light alone unless asked -- a page written
   partly in mirror script is stored as a picture of a page written partly in mirror script. */
(function (global) {
  'use strict';
  const JW = 600, JH = 840;

  const KIT = {
    papers: { lined: 'Lined', grid: 'Grid', dot: 'Dotted', plain: 'Plain', kraft: 'Kraft', parchment: 'Parchment' },
    // Faces both apps already carry, so the phone draws a page in the same hands as the web.
    fonts: {
      hand: ["'Caveat', cursive", 'Handwriting'],
      print: ["'Patrick Hand', cursive", 'Neat hand'],
      serif: ["'Spectral', serif", 'Book'],
      type: ["'JetBrains Mono', monospace", 'Typewriter'],
      stamp: ["'Cinzel', serif", 'Engraved'],
    },
    inks: ['#2b2118', '#1f3a5f', '#7a2e24', '#3d5a3a', '#6b4a7a', '#b8642e'],
    tapeColors: ['#e2894b', '#d9a441', '#9fb87a', '#7fa7b5', '#c97c8a', '#b9a28a', '#e9dcb4', '#6f86b0'],
    tapePatterns: ['solid', 'grid', 'stripe', 'dots', 'check'],
    stampWords: ['IDEA', 'DRAFT', 'REVISE', 'DONE', 'TODO', 'KEY SCENE', 'CANON', 'WHY?'],
    // Drawn stickers, viewBox 0 0 100 100: [path, fill, stroke].
    stickers: {
      sprig: [['M50 96 C50 70 48 40 52 6', 'none', '#5d6e3d'], ['M51 30 C36 26 28 14 30 6 C42 8 50 18 51 30Z', '#87a565', '#5d6e3d'], ['M52 44 C66 40 76 28 74 18 C62 20 52 32 52 44Z', '#9cb876', '#5d6e3d'], ['M50 60 C34 58 24 46 24 36 C38 36 48 48 50 60Z', '#7f9c5c', '#5d6e3d'], ['M51 74 C66 72 78 62 78 50 C64 52 53 62 51 74Z', '#8fae6a', '#5d6e3d']],
      flower: [['M50 22 a14 14 0 1 1 0.1 0Z', '#efb8ae', '#b86a5e'], ['M76 42 a14 14 0 1 1 0.1 0Z', '#efb8ae', '#b86a5e'], ['M66 72 a14 14 0 1 1 0.1 0Z', '#efb8ae', '#b86a5e'], ['M34 72 a14 14 0 1 1 0.1 0Z', '#efb8ae', '#b86a5e'], ['M24 42 a14 14 0 1 1 0.1 0Z', '#efb8ae', '#b86a5e'], ['M43 50 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', '#c98a3c', '#8a5a22']],
      leaf: [['M20 80 C20 40 50 14 86 14 C86 50 60 80 20 80Z', '#9bb77a', '#5f7340'], ['M22 78 C40 60 60 40 84 16', 'none', '#5f7340']],
      moon: [['M62 10 A40 40 0 1 0 90 72 A32 32 0 1 1 62 10Z', '#e8c77d', '#a07a2e']],
      star: [['M50 6 L61 38 L95 38 L67 58 L78 92 L50 72 L22 92 L33 58 L5 38 L39 38Z', '#e5b74e', '#a5781d']],
      heart: [['M50 88 C20 66 6 48 10 30 C14 14 36 10 50 28 C64 10 86 14 90 30 C94 48 80 66 50 88Z', '#d4706a', '#9a3f3a']],
      key: [['M8 50 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0', 'none', '#8a6a35'], ['M36 50 L92 50 M80 50 L80 64 M70 50 L70 60', 'none', '#8a6a35']],
      quill: [['M88 8 C60 14 36 36 22 70 L28 74 C44 44 64 24 88 8Z', '#e9dcc0', '#7a5c38'], ['M22 70 L12 92', 'none', '#2b2118']],
      compass: [['M10 50 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0', 'none', '#8a6a35'], ['M50 8 L58 50 L50 92 L42 50Z', '#c69a3a', '#8a6a35'], ['M8 50 L50 42 L92 50 L50 58Z', '#e9dcc0', '#8a6a35']],
      mountain: [['M6 88 L38 30 L52 52 L66 34 L94 88Z', '#9fb0c4', '#4f6276'], ['M38 30 L46 44 L40 42 L34 46Z', '#ffffff', '#4f6276']],
      sun: [['M32 50 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0', '#f0b54a', '#b9771d'], ['M50 8 L50 22 M50 78 L50 92 M8 50 L22 50 M78 50 L92 50 M20 20 L30 30 M70 70 L80 80 M80 20 L70 30 M30 70 L20 80', 'none', '#b9771d']],
      clip: [['M40 8 L40 70 A10 10 0 0 0 60 70 L60 20 A6 6 0 0 0 48 20 L48 64', 'none', '#6b6b6b']],
    },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (global.crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  function jitter(id, salt) {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 2001) / 1000 - 1;
  }

  // A torn edge, the same every time for the same item: small stable jags round the box.
  const torn = new Map();
  function tornEdge(id, w, h) {
    const key = id + ':' + Math.round(w) + 'x' + Math.round(h);
    if (torn.has(key)) return torn.get(key);
    let k = 0; const j = (a) => jitter(id, ++k) * a;
    const pts = [];
    for (let x = 0; x <= w; x += 9) pts.push([x, 2 + j(2)]);
    for (let y = 9; y <= h; y += 11) pts.push([w - 2 + j(1.5), y]);
    for (let x = w; x >= 0; x -= 7) pts.push([x, h - 3 + j(3)]);
    for (let y = h - 11; y > 0; y -= 11) pts.push([2 + j(1.5), y]);
    const out = 'polygon(' + pts.map(([x, y]) => x.toFixed(1) + 'px ' + y.toFixed(1) + 'px').join(',') + ')';
    torn.set(key, out);
    return out;
  }

  function tapeStyle(it) {
    const c = it.color || '#e2894b';
    const pat = {
      solid: '',
      grid: 'linear-gradient(rgba(255,255,255,.45) 1px,transparent 1px) 0 0/10px 10px,linear-gradient(90deg,rgba(255,255,255,.45) 1px,transparent 1px) 0 0/10px 10px,',
      stripe: 'repeating-linear-gradient(45deg,rgba(255,255,255,.4) 0 6px,transparent 6px 12px),',
      dots: 'radial-gradient(circle,rgba(255,255,255,.6) 2px,transparent 2.5px) 0 0/12px 12px,',
      check: 'repeating-conic-gradient(rgba(255,255,255,.35) 0 25%,transparent 0 50%) 0 0/16px 16px,',
    }[it.pattern || 'solid'] || '';
    return 'background:' + pat + c + ';';
  }
  function stickerSvg(name) {
    const shapes = KIT.stickers[name] || KIT.stickers.star;
    return '<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">' +
      shapes.map(([d, fill, stroke]) => '<path d="' + d + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>').join('') + '</svg>';
  }
  const stampLetters = (t) => [...String(t || '')].map((ch) => (ch === ' ' ? '<span class="jk-sl sp"></span>' : '<span class="jk-sl">' + esc(ch) + '</span>')).join('');
  const dayLabel = (d) => { const t = new Date(String(d) + 'T00:00:00'); return isNaN(t) ? String(d || '') : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
  const SOURCE_LABEL = { note: 'From the storyboard', scene: 'From a scene', document: 'From the library', character: 'Dramatis persona' };

  function itemHtml(it, selected) {
    const box = 'left:' + it.x + 'px;top:' + it.y + 'px;width:' + it.w + 'px;height:' + it.h + 'px;transform:rotate(' + (it.r || 0) + 'deg);z-index:' + ((it.z || 0) + 10);
    let inner = '';
    if (it.kind === 'text') {
      const family = (KIT.fonts[it.font] || KIT.fonts.hand)[0];
      inner = '<div class="jk-text" style="font-family:' + family + ';font-size:' + (it.size || 30) + 'px;color:' + (it.color || '#2b2118') + ';text-align:' + (it.align || 'left') + '">' +
        (esc(it.text || '').replace(/\n/g, '<br>') || '<span class="ph">Write…</span>') + '</div>';
    } else if (it.kind === 'tape') {
      inner = '<div class="jk-tape" style="' + tapeStyle(it) + '"></div>';
    } else if (it.kind === 'stamp') {
      const c = it.color || '#7a2e24';
      inner = it.shape === 'letters'
        ? '<div class="jk-stamp letters" style="color:' + c + '">' + stampLetters(it.text) + '</div>'
        : '<div class="jk-stamp ' + esc(it.shape || 'box') + '" style="color:' + c + ';border-color:' + c + '">' + esc(it.text || '') + '</div>';
    } else if (it.kind === 'sticker') {
      inner = '<div class="jk-sticker">' + stickerSvg(it.name) + '</div>';
    } else if (it.kind === 'image') {
      const edge = it.edge || 'deckle';
      inner = '<div class="jk-img ' + esc(edge) + '"' + (edge === 'torn' ? ' style="clip-path:' + tornEdge(it.id, it.w, it.h) + '"' : '') + '><img data-bucket="' + esc(it.bucket || 'journal-images') + '" data-path="' + esc(it.path || '') + '" alt=""></div>';
    } else if (it.kind === 'cutout') {
      inner = '<div class="jk-cut paper-' + esc(it.paper || 'newsprint') + '" style="clip-path:' + tornEdge(it.id, it.w, it.h) + '">' +
        '<div class="jk-cut-k">' + esc(SOURCE_LABEL[it.source] || '') + '</div><div class="jk-cut-t">' + esc(it.title || '') + '</div><div class="jk-cut-x">' + esc(it.text || '') + '</div></div>';
    }
    return '<div class="jk-item' + (selected ? ' sel' : '') + '" data-item="' + esc(it.id) + '" style="' + box + '">' + inner +
      (selected ? '<span class="jk-h rot" data-h="rot"></span><span class="jk-h res" data-h="res"></span>' : '') + '</div>';
  }

  /** Draw a page into a 600 x 840 sheet element. urlFor(bucket, path) -> Promise<url|null>. */
  function renderSheet(sheet, page, opts) {
    opts = opts || {};
    sheet.className = 'jk-sheet ' + (page.scan_path ? 'scanned' : 'paper-' + (page.paper || 'lined'));
    sheet.dataset.page = page.id;
    const items = (page.items || []).slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    sheet.innerHTML =
      (page.scan_path ? '<img class="jk-scan" data-bucket="journal-images" data-path="' + esc(page.scan_path) + '" alt="">' : '<div class="jk-date">' + esc(dayLabel(page.day)) + '</div>') +
      items.map((it) => itemHtml(it, opts.selectedId === it.id)).join('');
    if (opts.urlFor) {
      sheet.querySelectorAll('img[data-path]').forEach(async (img) => {
        const url = await opts.urlFor(img.dataset.bucket, img.dataset.path);
        if (url) img.src = url;
      });
    }
  }

  /**
   * A new item of a kind, with a little tilt, above everything there -- placed where the page is
   * emptiest rather than dead centre, so ten additions are ten things to arrange, not one pile.
   */
  function newItem(page, fields) {
    const items = page.items || [];
    const z = Math.max(0, ...items.map((i) => i.z || 0)) + 1;
    const overlap = (x, y) => items.reduce((sum, o) => {
      const w = Math.max(0, Math.min(x + fields.w, o.x + o.w) - Math.max(x, o.x));
      const h = Math.max(0, Math.min(y + fields.h, o.y + o.h) - Math.max(y, o.y));
      return sum + w * h;
    }, 0);
    let best = null;
    const mx = Math.max(10, JW - fields.w - 20), my = Math.max(10, JH - fields.h - 20);
    for (let gy = 0; gy <= 6; gy++) {
      for (let gx = 0; gx <= 4; gx++) {
        const x = 20 + ((mx - 20) * gx) / 4, y = 60 + ((my - 60) * gy) / 6;
        const score = overlap(x, y) + Math.hypot(x + fields.w / 2 - JW / 2, y + fields.h / 2 - JH / 2) * 0.5;
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    return Object.assign({
      id: uid(),
      x: Math.round(best.x + (Math.random() - 0.5) * 16),
      y: Math.round(best.y + (Math.random() - 0.5) * 16),
      r: Math.round((Math.random() - 0.5) * 8), z,
    }, fields);
  }

  /**
   * Editing: drag to move; the round handle rotates, the square one resizes; on a touch screen
   * two fingers pinch and turn the selected item. Double-click / double-tap text to write.
   * opts: pageOf(pageId) -> page, selected() -> {page,item}|null, onSelect(pageId, itemId|null),
   *       onChange(pageId), onTyping(pageId) (save without redrawing), onEditText(pageId, itemId)
   *       (optional: the host re-words stamps and cutouts itself).
   */
  function attach(container, opts) {
    const touches = new Map();
    let gesture = null;
    const scaleOf = (sheet) => sheet.getBoundingClientRect().width / JW || 1;

    container.addEventListener('pointerdown', (ev) => {
      const handle = ev.target.closest('[data-h]');
      const el = ev.target.closest('.jk-item');
      const sheet = ev.target.closest('.jk-sheet');
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!sheet) return;
      const page = opts.pageOf(sheet.dataset.page);
      if (!page) return;
      if (!el) { opts.onSelect(page.id, null); return; }
      if (el.querySelector('[contenteditable="true"]')) return;
      const it = (page.items || []).find((x) => x.id === el.dataset.item);
      if (!it) return;
      const sel = opts.selected();
      if (!sel || sel.item !== it.id) { opts.onSelect(page.id, it.id); }
      const target = () => container.querySelector('.jk-item[data-item="' + it.id + '"]');
      const s = scaleOf(sheet);
      // Two fingers on the selected item: pinch and turn.
      if (touches.size === 2 && gesture && gesture.it === it) {
        const [a, b] = [...touches.values()];
        gesture.mode = 'pinch';
        gesture.d0 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        gesture.a0 = Math.atan2(b.y - a.y, b.x - a.x);
        gesture.w0 = it.w; gesture.h0 = it.h; gesture.r0 = it.r || 0; gesture.size0 = it.size || 30;
        gesture.cx0 = it.x + it.w / 2; gesture.cy0 = it.y + it.h / 2;
        return;
      }
      const rect = el.getBoundingClientRect();
      gesture = {
        it, page, s, mode: handle ? handle.dataset.h : 'move', moved: false,
        x0: ev.clientX, y0: ev.clientY, ix: it.x, iy: it.y, iw: it.w, ih: it.h,
        cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, size0: it.size || 30,
      };
      ev.preventDefault();
    });

    container.addEventListener('pointermove', (ev) => {
      if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (!gesture) return;
      const g = gesture, it = g.it, el = container.querySelector('.jk-item[data-item="' + it.id + '"]');
      if (!el) return;
      if (g.mode === 'pinch' && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const k = Math.max(0.2, (Math.hypot(b.x - a.x, b.y - a.y) || 1) / g.d0);
        it.w = Math.round(g.w0 * k); it.h = Math.round(g.h0 * k);
        if (it.kind === 'text') it.size = Math.max(10, Math.round(g.size0 * k));
        it.x = Math.round(g.cx0 - it.w / 2); it.y = Math.round(g.cy0 - it.h / 2);
        it.r = Math.round(g.r0 + ((Math.atan2(b.y - a.y, b.x - a.x) - g.a0) * 180) / Math.PI);
        g.moved = true;
      } else {
        const dx = (ev.clientX - g.x0) / g.s, dy = (ev.clientY - g.y0) / g.s;
        if (!g.moved && Math.hypot(dx, dy) < 2) return;
        g.moved = true;
        if (g.mode === 'move') { it.x = Math.round(g.ix + dx); it.y = Math.round(g.iy + dy); }
        else if (g.mode === 'res') {
          const keep = it.kind === 'image' || it.kind === 'sticker';
          const w = Math.max(24, g.iw + dx);
          const h = keep ? w * (g.ih / g.iw) : Math.max(16, g.ih + dy);
          if (it.kind === 'text') it.size = Math.max(10, Math.round(g.size0 * (w / g.iw)));
          it.w = Math.round(w); it.h = Math.round(h);
        } else if (g.mode === 'rot') {
          it.r = Math.round((Math.atan2(ev.clientY - g.cy, ev.clientX - g.cx) * 180) / Math.PI + 90);
        }
      }
      el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; el.style.width = it.w + 'px'; el.style.height = it.h + 'px';
      el.style.transform = 'rotate(' + (it.r || 0) + 'deg)';
      const t = el.querySelector('.jk-text'); if (t && it.size) t.style.fontSize = it.size + 'px';
      ev.preventDefault();
    }, { passive: false });

    const end = (ev) => {
      touches.delete(ev.pointerId);
      if (!gesture) return;
      if (gesture.mode === 'pinch' && touches.size === 1) return; // one finger still down
      if (gesture.moved) opts.onChange(gesture.page.id);
      gesture = null;
    };
    // On the window, not the page: a mouse let go outside the page would otherwise leave the
    // gesture running, and the item would follow the pointer with no button held.
    global.addEventListener('pointerup', end);
    global.addEventListener('pointercancel', end);

    container.addEventListener('dblclick', (ev) => {
      const el = ev.target.closest('.jk-item'); const sheet = ev.target.closest('.jk-sheet');
      if (!el || !sheet) return;
      const page = opts.pageOf(sheet.dataset.page);
      const it = page && (page.items || []).find((x) => x.id === el.dataset.item);
      if (!it) return;
      // Stamps and cutouts are re-worded by the host (a prompt on the web, a sheet on the phone).
      if (it.kind !== 'text') { if (opts.onEditText) opts.onEditText(page.id, it.id); return; }
      const t = el.querySelector('.jk-text');
      t.contentEditable = 'true'; t.textContent = it.text || ''; t.focus();
      const r = document.createRange(); r.selectNodeContents(t); const s = document.getSelection(); s.removeAllRanges(); s.addRange(r);
      // Saved as it is typed (onTyping saves without redrawing, which would end the editing), and
      // drawn again when the writer leaves the text.
      t.oninput = () => { it.text = t.innerText.replace(/\n$/, ''); if (opts.onTyping) opts.onTyping(page.id); };
      t.onblur = () => { it.text = t.innerText.replace(/\n$/, ''); t.contentEditable = 'false'; opts.onChange(page.id); };
    });
  }

  // ---- scanning: a photograph of a notebook page becomes a page ---------------------------

  /** The projective map taking the output rectangle W x H onto a source quad [tl, tr, br, bl]. */
  function homography(W, H, quad) {
    const dst = [[0, 0], [W, 0], [W, H], [0, H]];
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i], [u, v] = quad[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    // Gaussian elimination with partial pivoting.
    for (let c = 0; c < 8; c++) {
      let p = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = c + 1; r < 8; r++) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const h = new Array(8);
    for (let r = 7; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < 8; k++) s -= A[r][k] * h[k]; h[r] = s / A[r][r]; }
    return h;
  }

  /** Flatten the quad of a source canvas into a W x H canvas (bilinear sampling). */
  function warpQuad(src, quad, W, H) {
    const sw = src.width, sh = src.height;
    const sdata = src.getContext('2d').getImageData(0, 0, sw, sh).data;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const octx = out.getContext('2d'); const img = octx.createImageData(W, H); const d = img.data;
    const [h0, h1, h2, h3, h4, h5, h6, h7] = homography(W, H, quad);
    let o = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++, o += 4) {
        const den = h6 * x + h7 * y + 1;
        let u = (h0 * x + h1 * y + h2) / den, v = (h3 * x + h4 * y + h5) / den;
        if (u < 0) u = 0; else if (u > sw - 1.001) u = sw - 1.001;
        if (v < 0) v = 0; else if (v > sh - 1.001) v = sh - 1.001;
        const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
        for (let c = 0; c < 3; c++) {
          const top = sdata[i00 + c] + (sdata[i10 + c] - sdata[i00 + c]) * fx;
          const bot = sdata[i01 + c] + (sdata[i11 + c] - sdata[i01 + c]) * fx;
          d[o + c] = top + (bot - top) * fy;
        }
        d[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return out;
  }

  /** Optional and off by default: stretch each channel between its 1st and 99th percentile. */
  function evenLight(canvas) {
    const ctx = canvas.getContext('2d');
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const d = img.data;
    const lo = [0, 0, 0], hi = [255, 255, 255];
    for (let c = 0; c < 3; c++) {
      const hist = new Uint32Array(256);
      for (let i = c; i < d.length; i += 16) hist[d[i]]++;
      const total = hist.reduce((a, n) => a + n, 0);
      let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo[c] = v; break; } }
      acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi[c] = v; break; } }
    }
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, ((d[i + c] - lo[c]) * 255) / Math.max(1, hi[c] - lo[c])));
    ctx.putImageData(img, 0, 0);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.crossOrigin = 'anonymous'; im.src = src; });
  }

  /** The source, rotated by quarter turns and capped at a sensible size, on a canvas. */
  function sourceCanvas(im, turns, maxSide) {
    const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
    const odd = turns % 2 === 1;
    const c = document.createElement('canvas'); c.width = odd ? h : w; c.height = odd ? w : h;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    return c;
  }

  /**
   * The scanner, drawn into `host` (which it fills). The writer drags the four corners of the
   * page -- or of the whole spread, with the split line set on the binding -- rotates if the
   * photo is sideways, and saves. onDone receives [{ dataUrl, width, height }], one per page.
   */
  async function openScanner(host, src, opts) {
    opts = opts || {};
    const im = await loadImage(src);
    const state = { turns: 0, spread: !!opts.spread, split: 0.5, even: false, quad: null, busy: false };
    host.innerHTML = '<div class="jk-scan-ui">' +
      '<div class="jk-scan-bar">' +
        '<button data-a="ccw" title="Rotate left">⟲</button><button data-a="cw" title="Rotate right">⟳</button>' +
        '<label><input type="checkbox" data-a="spread"' + (state.spread ? ' checked' : '') + '> Two pages (a spread)</label>' +
        '<label><input type="checkbox" data-a="even"> Even out the light</label>' +
        '<span class="sp"></span><button data-a="cancel">Cancel</button><button data-a="save" class="go">Keep this page</button>' +
      '</div>' +
      '<div class="jk-scan-hint">Drag the four corners onto the corners of the page' + ' — or of both pages, with the dashed line on the binding. Nothing else about the page is changed.</div>' +
      '<div class="jk-scan-stage"><canvas></canvas><svg></svg></div></div>';
    const stage = host.querySelector('.jk-scan-stage'), canvas = stage.querySelector('canvas'), svg = stage.querySelector('svg');
    let src0 = null, view = 1, ox = 0, oy = 0;

    function prepare() {
      src0 = sourceCanvas(im, state.turns, 3200);
      const W = src0.width, H = src0.height, m = 0.05;
      state.quad = [[W * m, H * m], [W * (1 - m), H * m], [W * (1 - m), H * (1 - m)], [W * m, H * (1 - m)]];
      draw();
    }
    function draw() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      view = Math.min(sw / src0.width, sh / src0.height);
      const w = Math.round(src0.width * view), h = Math.round(src0.height * view);
      ox = Math.round((sw - w) / 2); oy = Math.round((sh - h) / 2);
      canvas.width = w; canvas.height = h; canvas.style.left = ox + 'px'; canvas.style.top = oy + 'px';
      canvas.getContext('2d').drawImage(src0, 0, 0, w, h);
      svg.setAttribute('width', sw); svg.setAttribute('height', sh);
      const P = state.quad.map(([x, y]) => [ox + x * view, oy + y * view]);
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const sTop = lerp(P[0], P[1], state.split), sBot = lerp(P[3], P[2], state.split);
      svg.innerHTML =
        '<polygon points="' + P.map((p) => p.join(',')).join(' ') + '" fill="rgba(198,154,58,.12)" stroke="#e8b84a" stroke-width="2"/>' +
        (state.spread ? '<line x1="' + sTop[0] + '" y1="' + sTop[1] + '" x2="' + sBot[0] + '" y2="' + sBot[1] + '" stroke="#e8b84a" stroke-width="2" stroke-dasharray="8 6"/>' +
          '<circle data-split="1" cx="' + (sTop[0] + sBot[0]) / 2 + '" cy="' + (sTop[1] + sBot[1]) / 2 + '" r="13" fill="#e8b84a" stroke="#fff" stroke-width="2"/>' : '') +
        P.map((p, i) => '<circle data-c="' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="15" fill="rgba(232,184,74,.85)" stroke="#fff" stroke-width="2"/>').join('');
    }
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      const c = ev.target.closest('[data-c],[data-split]'); if (!c) return;
      drag = c.dataset.split ? { split: true } : { i: Number(c.dataset.c) };
      svg.setPointerCapture && svg.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left - ox) / view, y = (ev.clientY - r.top - oy) / view;
      if (drag.split) {
        const [tl, tr] = state.quad; const dx = tr[0] - tl[0], dy = tr[1] - tl[1];
        state.split = Math.max(0.15, Math.min(0.85, ((x - tl[0]) * dx + (y - tl[1]) * dy) / (dx * dx + dy * dy)));
      } else {
        state.quad[drag.i] = [Math.max(0, Math.min(src0.width, x)), Math.max(0, Math.min(src0.height, y))];
      }
      draw(); ev.preventDefault();
    }, { passive: false });
    svg.addEventListener('pointerup', () => { drag = null; });

    host.querySelector('.jk-scan-bar').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-a]'); if (!b || state.busy) return;
      const a = b.dataset.a;
      if (a === 'cw' || a === 'ccw') { state.turns = (state.turns + (a === 'cw' ? 1 : 3)) % 4; prepare(); }
      if (a === 'cancel') opts.onCancel && opts.onCancel();
      if (a === 'save') {
        state.busy = true; b.textContent = 'Straightening…';
        await new Promise((r) => setTimeout(r, 30));
        const q = state.quad, len = (a1, b1) => Math.hypot(b1[0] - a1[0], b1[1] - a1[1]);
        let W = Math.max(len(q[0], q[1]), len(q[3], q[2])), H = Math.max(len(q[0], q[3]), len(q[1], q[2]));
        const k = Math.min(1, 2600 / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
        const flat = warpQuad(src0, q, W, H);
        if (state.even) evenLight(flat);
        const parts = [];
        if (state.spread) {
          const cut = Math.round(W * state.split);
          for (const [x0, w] of [[0, cut], [cut, W - cut]]) {
            const c = document.createElement('canvas'); c.width = w; c.height = H;
            c.getContext('2d').drawImage(flat, x0, 0, w, H, 0, 0, w, H);
            parts.push(c);
          }
        } else parts.push(flat);
        opts.onDone && opts.onDone(parts.map((c) => ({ dataUrl: c.toDataURL('image/jpeg', 0.9), width: c.width, height: c.height })));
      }
    });
    host.querySelector('.jk-scan-bar').addEventListener('change', (ev) => {
      const a = ev.target.dataset.a;
      if (a === 'spread') { state.spread = ev.target.checked; draw(); }
      if (a === 'even') state.even = ev.target.checked;
    });
    global.addEventListener('resize', () => src0 && draw());
    prepare();
  }

  /**
   * A page's words, top to bottom, for copying into a project's Pages: the title or the date,
   * then each piece of writing, stamp and cut-out in reading order. Tape, stickers and pictures
   * have no words and stay in the journal; so does a scan, which is noted rather than transcribed.
   */
  function pageText(page) {
    const words = (page.items || [])
      .filter((it) => (it.kind === 'text' || it.kind === 'stamp' || it.kind === 'cutout') && (it.text || it.title))
      .sort((a, b) => (Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x))
      .map((it) => (it.kind === 'cutout' ? [it.title, it.text].filter(Boolean).join(' — ') : String(it.text)));
    const head = page.title ? page.title + '\n' + dayLabel(page.day) : dayLabel(page.day);
    const scan = page.scan_path ? ['(A scanned journal page. The page itself stays in the journal.)'] : [];
    return [head, ...scan, ...words].join('\n\n');
  }

  global.JournalKit = { JW, JH, KIT, esc, uid, dayLabel, tornEdge, tapeStyle, stickerSvg, stampLetters, itemHtml, renderSheet, newItem, attach, homography, warpQuad, evenLight, openScanner, pageText };
})(typeof window !== 'undefined' ? window : globalThis);
