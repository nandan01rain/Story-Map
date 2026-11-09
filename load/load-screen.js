/* The load screen (2026-11-09) -- the web twin of mobile/src/components/LoadScreen.tsx, with the
   same geometry and timings. It draws itself the moment this script runs (it sits at the top of
   <body>), spins a zoetrope wheel of frames beneath the rose, and waits to be told the app is
   ready. Then the wheel slows and stops -- on the last project opened, if it is on the wheel --
   and the screen fades. Clicking a frame stops the wheel on it and opens that project.

   The host (index.html) calls:  StoryMapLoad.setProjects([{id, name}]) · setFront(id) · ready()
   and sets                      StoryMapLoad.onPick = (project) => …                          */
(function () {
  'use strict';
  // MAX_WAIT: if the host never says it is ready (the Supabase script failed to load, say), the
  // cover lifts anyway rather than spinning over a page that can still show what went wrong.
  const MIN_LOAD = 2400, MAX_WAIT = 8000, SPIN_PERIOD = 7000, SPEED = (2 * Math.PI) / (SPIN_PERIOD / 1000);
  const FW = 104, FH = 80, TILT = 16;
  const root = document.getElementById('load-screen');
  if (!root) return;
  const started = performance.now();
  let projects = [], front = null, appReady = false, picked = null;
  let slots = 10, step = (2 * Math.PI) / slots;
  let mode = 'spinup', rot = 0, last = started, settle = null, settled = false, fading = false;
  let frames = [];

  const W = () => window.innerWidth, H = () => window.innerHeight;
  const logoSize = () => Math.min(W() * 0.5, 230);
  const R = () => Math.min(W() * 0.4, 200);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  root.innerHTML =
    '<div class="ls-logo"><div class="ls-halo"></div>' +
    '<svg class="ls-bezel" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="#b8862e" stroke-width=".5" stroke-dasharray=".6 2.4"/>' +
    '<circle cx="50" cy="50" r="45.5" fill="none" stroke="#b8862e" stroke-width=".3" opacity=".6"/></svg>' +
    '<div class="ls-rose"><img src="load/load-rose.png" alt=""><div class="ls-shine"></div></div></div>' +
    '<div class="ls-words"><div class="ls-word">STORYMAP</div><div class="ls-tag">Chart the past. Shape the future.</div></div>' +
    '<div class="ls-shadow"></div><div class="ls-track"></div><div class="ls-wheel"></div>';
  const $ = (s) => root.querySelector(s);

  function layout() {
    const logo = logoSize(), top = H() * 0.36 - logo / 2, wheelTop = top + logo + 92;
    Object.assign($('.ls-logo').style, { top: top + 'px', width: logo + 'px', height: logo + 'px' });
    $('.ls-words').style.top = top + logo + 14 + 'px';
    $('.ls-wheel').style.top = wheelTop + 'px';
    Object.assign($('.ls-track').style, { top: wheelTop + FH / 2 - TILT + 'px', width: 2 * R() + 'px', height: 2 * TILT + 'px' });
    Object.assign($('.ls-shadow').style, { top: wheelTop + FH - 2 + 'px', width: 2 * (R() + FW * 0.35) + 'px', height: 2 * (TILT + 6) + 'px' });
    root.querySelectorAll('.ls-mote').forEach((m) => m.remove());
    for (let i = 0; i < 9; i++) {
      const m = document.createElement('span');
      const size = 2 + ((i * 7) % 3);
      m.className = 'ls-mote';
      Object.assign(m.style, {
        left: W() / 2 + (((i * 37) % 100) / 100 - 0.5) * logo * 1.5 + 'px', top: top + logo + 'px',
        width: size + 'px', height: size + 'px', animationDelay: ((i * 530) % 3200) + 'ms',
      });
      m.style.setProperty('--rise', -logo * 1.1 + 'px');
      m.style.setProperty('--dx', (i % 2 ? 1 : -1) * (6 + (i % 4) * 3) + 'px');
      root.appendChild(m);
    }
  }

  // Never fewer than ten frames, so two projects still make a drum; the rest are blank film.
  function build() {
    slots = Math.max(10, Math.min(16, projects.length));
    step = (2 * Math.PI) / slots;
    const holes = '<div class="ls-holes">' + '<i></i>'.repeat(6) + '</div>';
    $('.ls-wheel').innerHTML = Array.from({ length: slots }, (_, i) => {
      const p = projects[i];
      return '<div class="ls-frame' + (p ? ' has' : '') + '" data-i="' + i + '">' + holes +
        '<div class="ls-win">' + (p ? '<span class="ls-no">' + String(i + 1).padStart(2, '0') + '</span><div class="ls-face">' + esc(p.name) + '</div>' : '') +
        '<div class="ls-back"></div></div>' + holes + '</div>';
    }).join('');
    frames = [...root.querySelectorAll('.ls-frame')].map((el) => ({ el, face: el.querySelector('.ls-face'), no: el.querySelector('.ls-no'), back: el.querySelector('.ls-back') }));
  }

  function place() {
    const r = R();
    frames.forEach((f, i) => {
      const a = rot + i * step, s = Math.sin(a), c = Math.cos(a), depth = (c + 1) / 2;
      f.el.style.zIndex = Math.round(depth * 100);
      f.el.style.opacity = 0.3 + 0.7 * depth;
      // Facing outward from the drum: edge-on at the sides, its back showing behind.
      f.el.style.transform = 'translate(' + r * s + 'px,' + TILT * c + 'px) scale(' + (0.7 + 0.3 * depth) + ') scaleX(' + Math.max(0.05, Math.abs(c)) + ')';
      const faceOn = Math.min(1, Math.max(0, c * 3));
      if (f.face) { f.face.style.opacity = faceOn; f.no.style.opacity = faceOn; }
      f.back.style.opacity = Math.min(0.9, Math.max(0, -c * 3));
    });
  }

  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  function tick(now) {
    const dt = (now - last) / 1000; last = now;
    if (mode === 'spinup') {
      const t = Math.min(1, (now - started) / 1500);
      rot = Math.PI * 1.6 * easeOutQuad(t);
      if (t >= 1) mode = 'steady';
    } else if (mode === 'steady') {
      rot += SPEED * dt;
    } else if (mode === 'settle') {
      const t = Math.min(1, (now - settle.t0) / settle.duration);
      rot = settle.from + (settle.to - settle.from) * easeOutCubic(t);
      if (t >= 1) { mode = 'still'; onSettled(); }
    }
    place();
    if (mode === 'steady' && appReady && now - started >= MIN_LOAD) stopOnFront();
    if (!fading || mode !== 'still') requestAnimationFrame(tick);
  }

  function stopOn(k, quick) {
    if (mode === 'settle' || mode === 'still') return;
    const base = -k * step, lead = quick ? 0.15 : 0.35;
    const to = base + 2 * Math.PI * Math.ceil((rot + lead - base) / (2 * Math.PI));
    const duration = Math.min(quick ? 900 : 2000, Math.max(700, ((3 * (to - rot)) / SPEED) * 1000));
    settle = { from: rot, to, duration, t0: performance.now(), quick };
    mode = 'settle';
  }
  function stopOnFront() {
    const k = front ? projects.findIndex((p) => p.id === front) : -1;
    if (k >= 0) return stopOn(k, false);
    stopOn(Math.round((((-rot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / step) % slots, false);
  }
  // Gone once the wheel has stopped and the app is ready, whichever comes last.
  function onSettled() {
    settled = true;
    const c = frames.map((f, i) => Math.cos(rot + i * step));
    const k = c.indexOf(Math.max(...c));
    if (frames[k]) frames[k].el.classList.add('lit');
    if (appReady) fadeOut(settle.quick ? 150 : 380);
  }
  function fadeOut(delay) {
    if (fading) return;
    fading = true;
    setTimeout(() => {
      root.classList.add('gone');
      setTimeout(() => { root.remove(); if (picked && api.onPick) api.onPick(picked); }, 470);
    }, delay);
  }

  $('.ls-wheel').addEventListener('click', (ev) => {
    const el = ev.target.closest('.ls-frame'); if (!el) return;
    const k = Number(el.dataset.i), p = projects[k];
    if (!p || picked || Math.cos(rot + k * step) < 0.25) return;
    picked = p;
    stopOn(k, true);
  });

  const api = {
    onPick: null,
    setProjects(list) {
      if (mode === 'settle' || mode === 'still') return; // the wheel has already been read
      projects = (list || []).slice(0, 16);
      build(); place();
    },
    setFront(id) { front = id || null; },
    ready() {
      if (appReady) return;
      appReady = true;
      if (settled) fadeOut(150); // a frame was clicked first, and the wheel waited
    },
  };
  window.StoryMapLoad = api;
  window.addEventListener('resize', () => { layout(); place(); });
  layout(); build(); place();
  requestAnimationFrame(tick);
  setTimeout(() => api.ready(), MAX_WAIT);
})();
