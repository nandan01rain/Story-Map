// Builds mobile/src/lib/journalHtml.ts: the journal page as one document for the phone's WebView.
//
//   node scripts/build-journal-html.mjs
//
// It inlines journal/journal-kit.css + journal-kit.js (shared with studio.html, unchanged) and
// journal/journal-phone.js (the bar, the palette and the bridge to the app). Rerun it after
// changing any of the three; the generated file is committed so an OTA update carries it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const OUT = path.join(ROOT, 'mobile', 'src', 'lib', 'journalHtml.ts');

const kitCss = read('journal/journal-kit.css');
const kitJs = read('journal/journal-kit.js');
const phoneJs = read('journal/journal-phone.js');

// What the studio draws around a page in its own window, drawn here for a phone: a desk, the page
// fitted to it, a bar beneath, and a palette that slides up over the lower half.
const phoneCss = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#5a3c25;font-family:'Spectral',serif;-webkit-tap-highlight-color:transparent}
body{display:flex;flex-direction:column}
#desk{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;touch-action:none;
  background-color:#6b4a2f;background-image:repeating-linear-gradient(92deg,rgba(255,220,170,.05) 0 3px,transparent 3px 9px,rgba(40,20,5,.08) 9px 11px,transparent 11px 23px),var(--jk-fibres),linear-gradient(180deg,#7a553a,#5a3c25)}
#frame{position:relative;overflow:hidden;border-radius:3px;box-shadow:0 12px 30px rgba(0,0,0,.5)}
#bar{min-height:54px;display:flex;align-items:center;gap:8px;padding:7px 10px;background:#2a1c11;color:#efe3c8;border-top:1px solid rgba(232,184,74,.35);overflow-x:auto}
#bar .hint{font-size:13px;opacity:.75;font-style:italic;line-height:1.25}
.tools{display:flex;align-items:center;gap:7px;flex-wrap:nowrap}
#bar button,.cyc{flex:none;background:none;border:1px solid rgba(232,184,74,.55);color:#efe3c8;border-radius:8px;padding:7px 10px;font:inherit;font-size:14px;white-space:nowrap}
#bar .sw{width:26px;height:26px;border-radius:50%;padding:0;border:2px solid transparent}
#bar .sw.on{border-color:#fff}
#bar .del{border-color:#c0574a;color:#f3b3a8}
button.go{background:#c69a3a !important;color:#2b1a05 !important;border-color:#c69a3a !important;font-weight:600}
#pal{position:fixed;left:0;right:0;bottom:0;height:62%;background:#f4ead6;color:#2b2118;border-radius:16px 16px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.45);transform:translateY(105%);transition:transform .22s ease;display:flex;flex-direction:column;z-index:900}
#pal.open{transform:none}
#pal-tabs{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(80,50,20,.2)}
#pal-tabs button{background:none;border:1px solid rgba(80,50,20,.35);border-radius:16px;padding:6px 14px;font:inherit;font-size:15px;color:#2b2118}
#pal-tabs button.on{background:#2b2118;color:#f4ead6}
#pal-tabs .sp{flex:1}
#pal-body{overflow:auto;padding:4px 12px 40px;-webkit-overflow-scrolling:touch}
#pal-body h4{font-family:'Cinzel',serif;font-size:11px;letter-spacing:.15em;color:#8a6420;margin:14px 0 7px;text-transform:uppercase}
#pal-body .hint{font-size:14px;color:#7a6650;margin:6px 0}
#pal-body .row{display:flex;flex-wrap:wrap;gap:7px}
.p-text{background:#fbf6ea;color:#2b2118;border:1px solid #c9b48e;border-radius:6px;padding:5px 11px;font-size:20px}
.tapes{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.p-tape{height:26px;border:none;opacity:.9;clip-path:polygon(0 10%,4% 0,8% 10%,92% 0,96% 10%,100% 0,100% 90%,96% 100%,92% 90%,8% 100%,4% 90%,0 100%)}
.p-stamp{background:#fbf6ea;border:2px solid;border-radius:4px;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:12px;letter-spacing:.1em;padding:5px 8px}
.p-stamp.circle{border-radius:50%;border-style:double;border-width:4px;padding:9px 6px}
.p-stamp.date{border-style:double;border-width:4px}
.p-stamp.letters{border:none;background:none;padding:0;display:inline-flex;gap:2px}
.p-stamp.letters .jk-sl{width:22px;height:28px;font-size:16px}
.stickers{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.p-sticker{background:#fbf6ea;border:1px solid #c9b48e;border-radius:8px;aspect-ratio:1;padding:8px}
.imgs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}
.p-img{padding:0;border:1px solid #c9b48e;border-radius:4px;aspect-ratio:1;overflow:hidden;background:#ddd}
.p-img img{width:100%;height:100%;object-fit:cover}
.wide{width:100%;padding:11px;border-radius:10px;font:inherit;font-size:16px;border:none}
#pq{width:100%;font:inherit;font-size:16px;padding:9px 11px;border:1px solid #c9b48e;border-radius:8px;background:#fbf6ea;margin-top:8px}
.list{display:flex;flex-direction:column;gap:4px}
.list button{text-align:left;background:#fbf6ea;border:1px solid #d9c7a3;color:#2b2118;border-radius:7px;padding:9px 10px;font:inherit;font-size:15px;display:flex;align-items:center;gap:8px}
.dot{width:12px;height:12px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.2)}
#scanner{position:fixed;inset:0;z-index:1000}
`;

// The faces the kit names. Loaded from Google Fonts, as the braid loads three.js from a CDN: the
// journal needs the network for its pictures anyway, and the fallbacks are still a hand and a serif.
const fonts = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Patrick+Hand&family=Spectral:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@700&family=Cinzel:wght@600&display=swap';

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${fonts}">
<style>${kitCss}
${phoneCss}</style></head>
<body>
<div id="desk"><div id="frame"><div id="sheet" class="jk-sheet"></div></div></div>
<div id="bar"></div>
<div id="pal"><div id="pal-tabs"></div><div id="pal-body"></div></div>
<div id="scanner" hidden></div>
<script>${kitJs}</script>
<script>${phoneJs}</script>
</body></html>`;

const out = `// GENERATED FILE - do not edit by hand.
// Rebuild with: node scripts/build-journal-html.mjs
//
// A journal page for the WebView: journal/journal-kit.css + journal-kit.js, shared with
// studio.html, and journal/journal-phone.js. No data inside -- the app posts the page in once the
// document says it is ready, as the braid does.
export const JOURNAL_HTML = ${JSON.stringify(html)};
`;
fs.writeFileSync(OUT, out);
console.log(`wrote ${path.relative(ROOT, OUT)} (${(out.length / 1024).toFixed(1)} KB)`);
