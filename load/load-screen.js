/* The load screen (2026-11-09) -- the web twin of mobile/src/components/LoadScreen.tsx. Beige
   paper and the gold compass rose, with its glow, turning bezel, shine and gold dust; nothing
   else (the projects' wheel is on the Projects page: wheel/project-wheel.js). It draws itself the
   moment this script runs (it sits at the top of <body>) and fades once the host says the app is
   ready, and not before MIN_LOAD, so it is seen rather than flashed.

   The host (index.html) calls StoryMapLoad.ready(). */
(function () {
  'use strict';
  // MAX_WAIT: if the host never says it is ready (the Supabase script failed to load, say), the
  // cover lifts anyway rather than hiding a page that can still show what went wrong.
  const MIN_LOAD = 2400, MAX_WAIT = 8000;
  const root = document.getElementById('load-screen');
  if (!root) return;
  const started = performance.now();
  let gone = false;

  root.innerHTML =
    '<div class="ls-logo"><div class="ls-halo"></div>' +
    '<svg class="ls-bezel" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="#b8862e" stroke-width=".5" stroke-dasharray=".6 2.4"/>' +
    '<circle cx="50" cy="50" r="45.5" fill="none" stroke="#b8862e" stroke-width=".3" opacity=".6"/></svg>' +
    '<div class="ls-rose"><img src="load/load-rose.png" alt=""><div class="ls-shine"></div></div></div>';

  function layout() {
    const logo = Math.min(window.innerWidth * 0.5, 230), top = window.innerHeight / 2 - logo / 2;
    Object.assign(root.querySelector('.ls-logo').style, { top: top + 'px', width: logo + 'px', height: logo + 'px' });
    root.querySelectorAll('.ls-mote').forEach((m) => m.remove());
    for (let i = 0; i < 9; i++) {
      const m = document.createElement('span');
      const size = 2 + ((i * 7) % 3);
      m.className = 'ls-mote';
      Object.assign(m.style, {
        left: window.innerWidth / 2 + (((i * 37) % 100) / 100 - 0.5) * logo * 1.5 + 'px', top: top + logo + 'px',
        width: size + 'px', height: size + 'px', animationDelay: ((i * 530) % 3200) + 'ms',
      });
      m.style.setProperty('--rise', -logo * 1.1 + 'px');
      m.style.setProperty('--dx', (i % 2 ? 1 : -1) * (6 + (i % 4) * 3) + 'px');
      root.appendChild(m);
    }
  }

  function ready() {
    if (gone) return;
    gone = true;
    setTimeout(() => {
      root.classList.add('gone');
      setTimeout(() => root.remove(), 470);
    }, Math.max(0, MIN_LOAD - (performance.now() - started)));
  }

  window.StoryMapLoad = { ready };
  window.addEventListener('resize', layout);
  layout();
  setTimeout(ready, MAX_WAIT);
})();
