/* The project wheel (2026-11-09) -- the web twin of mobile/src/components/ProjectWheel.tsx. The
   writer's projects as frames on a zoetrope drum, the wheel of frames spun to make pictures move:
   each frame faces outward, so it turns edge-on at the sides and shows the back of the film as it
   passes behind. Frames past the projects are blank film; the wheel never settles on one.

   Drag (or swipe) to turn it, and it settles on a project; the mouse wheel and the arrow keys
   turn it a frame at a time; click the front frame to open it, or another to bring it round.

     const wheel = ProjectWheel.mount(el, { onFront(p), onOpen(p) });
     wheel.setProjects([{ id, name }], frontId)   // the first call opens with a turn to frontId
     wheel.setFront(id)                            // turn to a project                          */
(function (global) {
  'use strict';
  const FW = 104, FH = 80, TILT = 16;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function mount(el, opts) {
    el.classList.add('pw');
    el.tabIndex = 0;
    el.innerHTML = '<div class="pw-shadow"></div><div class="pw-track"></div><div class="pw-hub"></div>';
    const hub = el.querySelector('.pw-hub');
    let projects = [], slots = 10, step = (2 * Math.PI) / slots, rot = 0, frames = [];
    let anim = null, frontId = null, opened = false;
    const R = () => Math.min(el.clientWidth * 0.4, 200);

    function build() {
      slots = Math.max(10, projects.length);
      step = (2 * Math.PI) / slots;
      const holes = '<div class="pw-holes">' + '<i></i>'.repeat(6) + '</div>';
      hub.innerHTML = Array.from({ length: slots }, (_, i) => {
        const p = projects[i];
        return '<div class="pw-frame' + (p ? ' has' : '') + '" data-i="' + i + '">' + holes +
          '<div class="pw-win">' + (p ? '<span class="pw-no">' + String(i + 1).padStart(2, '0') + '</span><div class="pw-face">' + esc(p.name) + '</div>' : '') +
          '<div class="pw-back"></div></div>' + holes + '</div>';
      }).join('');
      frames = [...hub.querySelectorAll('.pw-frame')].map((f) => ({ el: f, face: f.querySelector('.pw-face'), no: f.querySelector('.pw-no'), back: f.querySelector('.pw-back') }));
      layout();
    }
    function layout() {
      const r = R();
      Object.assign(el.querySelector('.pw-track').style, { width: 2 * r + 'px', height: 2 * TILT + 'px', top: 30 + FH / 2 + 'px' });
      Object.assign(el.querySelector('.pw-shadow').style, { width: 2 * (r + FW * 0.35) + 'px', height: 2 * (TILT + 6) + 'px', top: 30 + FH - 2 + 'px' });
      place();
    }
    function place() {
      const r = R();
      frames.forEach((f, i) => {
        const a = rot + i * step, c = Math.cos(a), depth = (c + 1) / 2;
        f.el.style.zIndex = Math.round(depth * 100);
        f.el.style.opacity = 0.3 + 0.7 * depth;
        f.el.style.transform = 'translate(' + r * Math.sin(a) + 'px,' + TILT * c + 'px) scale(' + (0.7 + 0.3 * depth) + ') scaleX(' + Math.max(0.05, Math.abs(c)) + ')';
        const on = Math.min(1, Math.max(0, c * 3));
        if (f.face) { f.face.style.opacity = on; f.no.style.opacity = on; }
        f.back.style.opacity = Math.min(0.9, Math.max(0, -c * 3));
        f.el.classList.toggle('lit', !!f.face && c > 0.97);
      });
    }

    // The project slot nearest the front for a rotation -- never a blank one.
    function nearest(r) {
      let best = -1, bestCos = -2;
      projects.forEach((_, k) => { const c = Math.cos(r + k * step); if (c > bestCos) { bestCos = c; best = k; } });
      return best;
    }
    function rotFor(k, r) { const base = -k * step; return base + 2 * Math.PI * Math.round((r - base) / (2 * Math.PI)); }
    function animateTo(target, duration, done) {
      const from = rot, t0 = performance.now();
      if (anim) cancelAnimationFrame(anim.id);
      anim = { id: 0 };
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        rot = from + (target - from) * easeOut(t);
        place();
        if (t < 1) anim.id = requestAnimationFrame(frame);
        else { anim = null; if (done) done(); }
      };
      anim.id = requestAnimationFrame(frame);
    }
    function settleOn(k, duration) {
      if (k < 0) return;
      animateTo(rotFor(k, rot), duration || 600, () => report(k));
    }
    function report(k) {
      const p = projects[k];
      if (!p) return;
      frontId = p.id;
      if (opts.onFront) opts.onFront(p);
    }

    // Dragging: the frames follow the pointer, then the wheel carries on a little and settles.
    let drag = null;
    el.addEventListener('pointerdown', (ev) => {
      if (!projects.length) return;
      drag = { x0: ev.clientX, r0: rot, last: ev.clientX, t: performance.now(), v: 0, moved: false };
      if (anim) { cancelAnimationFrame(anim.id); anim = null; }
    });
    window.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x0;
      if (Math.abs(dx) > 4) drag.moved = true;
      const now = performance.now();
      drag.v = (ev.clientX - drag.last) / Math.max(1, now - drag.t) * 1000;
      drag.last = ev.clientX; drag.t = now;
      rot = drag.r0 + dx / R();
      place();
    });
    window.addEventListener('pointerup', (ev) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved) { settleOn(nearest(rot + (d.v / R()) * 0.25), 700); return; }
      // A click, not a drag: open the front frame, or bring another round.
      const f = ev.target.closest && ev.target.closest('.pw-frame.has');
      if (!f || !el.contains(f)) return settleOn(nearest(rot), 400);
      const k = Number(f.dataset.i);
      if (Math.cos(rot + k * step) > 0.97) { if (opts.onOpen) opts.onOpen(projects[k]); }
      else settleOn(k, 550);
    });
    // A frame at a time: the mouse wheel and the arrow keys.
    function turnBy(n) {
      const k = nearest(rot);
      if (k < 0) return;
      settleOn((k + n + projects.length) % projects.length, 450);
    }
    let wheelLock = 0;
    el.addEventListener('wheel', (ev) => {
      if (!projects.length) return;
      ev.preventDefault();
      const now = performance.now();
      if (now - wheelLock < 220) return;
      wheelLock = now;
      turnBy((ev.deltaX || ev.deltaY) > 0 ? 1 : -1);
    }, { passive: false });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') { turnBy(1); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { turnBy(-1); ev.preventDefault(); }
      if (ev.key === 'Enter') { const k = nearest(rot); if (k >= 0 && opts.onOpen) opts.onOpen(projects[k]); }
    });
    // Laid out again whenever its size changes -- including when a hidden tab it was built in is
    // first shown, which is when its width stops being zero.
    if (global.ResizeObserver) new ResizeObserver(layout).observe(el);
    else window.addEventListener('resize', layout);

    return {
      setProjects(list, wantFront) {
        projects = (list || []).map((p) => ({ id: p.id, name: p.name }));
        if (wantFront !== undefined) frontId = wantFront;
        build();
        if (!projects.length) return;
        const k = Math.max(0, projects.findIndex((p) => p.id === frontId));
        if (!opened) {
          // The opening turn: once round, coming to rest on the project at the front.
          opened = true;
          rot = rotFor(k, 0) - 2 * Math.PI;
          place();
          animateTo(rotFor(k, 0), 1600, () => report(k));
        } else {
          settleOn(k, 450);
        }
      },
      setFront(id) {
        const k = projects.findIndex((p) => p.id === id);
        if (k >= 0) settleOn(k, 550);
      },
    };
  }

  global.ProjectWheel = { mount };
})(window);
