const fs = require('fs');
const p = 'src/screens/ReaderScreen.tsx';
let s = fs.readFileSync(p, 'utf8');

const broken = `  const pattern = trimmed
    .replace(/[.*+?^\${}()|[\\]\\]/g, '\\$&')
    .replace(/\\s+/g, '\\s+');`;

const fixed = [
  '  const pattern = trimmed',
  '    .replace(/[.*+?^${}()|[\\]\\\\]/g, String.raw`\\$&`)',
  '    .replace(/\\s+/g, String.raw`\\s+`);',
].join('\n');

if (!s.includes(broken)) {
  console.error('anchor not found');
  process.exit(1);
}
s = s.replace(broken, fixed);
fs.writeFileSync(p, s);
console.log('patched');
