import { Path, Svg } from 'react-native-svg';

// Exact icon paths ported from the PWA's <symbol> sprite sheet (index.html:1363-1390) --
// same viewBox (0 0 24 24), same `d` data, same stroke-width, so every icon in the
// mobile app is pixel-identical in shape to its PWA counterpart, just re-rendered via
// react-native-svg instead of <use href="#icon-x">.
// `extra` paths are always stroked and never filled, so a filled icon can still carry an
// outline-only detail alongside its solid body.
const ICONS: Record<string, { d: string[]; fill?: boolean; strokeWidth?: number; extra?: string[] }> = {
  map: { d: ['M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z', 'M9 4v14M15 6v14'] },
  list: { d: ['M9 3h6v3H9zM8 10h8M8 14h8M8 18h5'], fill: false },
  search: { d: ['M15 15l5 5'] },
  eye: { d: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z'] },
  link: { d: ['M8 12l-2 2a3 3 0 004 4l3-3M16 12l2-2a3 3 0 00-4-4l-3 3M9 15l6-6'] },
  'book-open': { d: ['M3 5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1z', 'M12 6v13'] },
  compass: { d: ['M15 9l-2 6-6 2 2-6z'] },
  books: { d: [] },
  download: { d: ['M12 3v11M8 10l4 4 4-4M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3'] },
  upload: { d: ['M12 14V3M8 7l4-4 4 4M4 17v3a1 1 0 001 1h14a1 1 0 001-1v-3'] },
  'book-closed': { d: ['M9 4v16'] },
  bookmark: { d: ['M6 3h9a2 2 0 012 2v16l-6.5-3L4 21V5a2 2 0 012-2z'] },
  'bookmark-filled': { d: ['M6 3h9a2 2 0 012 2v16l-6.5-3L4 21V5a2 2 0 012-2z'], fill: true },
  pin: { d: ['M12 13v8'] },
  mail: { d: ['M4 6.5l8 6 8-6'] },
  lock: { d: ['M8 11V7a4 4 0 018 0v4'] },
  'eye-off': { d: ['M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M6.5 6.7C4 8.3 2 12 2 12s4 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 4.2A10.4 10.4 0 0112 4c6 0 10 7 10 7-.5.9-1.5 2.3-2.9 3.6'] },
  home: { d: ['M4 11l8-7 8 7', 'M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9'] },
  plus: { d: ['M12 5v14M5 12h14'], strokeWidth: 1.8 },
  user: { d: ['M4 20c0-4 3.5-6 8-6s8 2 8 6'] },
  folder: { d: ['M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1z'] },
  pencil: { d: ['M4 20l1-4.5L15.5 5 19 8.5 8.5 19z', 'M13.5 6.5L17.5 10.5'] },
  feather: { d: ['M20 4c-7 0-14 4-14 12v4h4c8 0 12-7 12-14V4z', 'M4 20L15 9'] },
  gear: { d: ['M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7L6.3 6.3'] },
  trash: { d: ['M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13'] },
  sparkle: { d: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'] },
  swap: { d: ['M4 7h13M14 4l3 3-3 3M20 17H7M10 20l-3-3 3-3'] },
  exit: { d: ['M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4M15 12H8M12 8l4 4-4 4'] },
  // Added for ReaderScreen's selection action bar (Flag/Copy/Pin/Share/Editor), so those
  // icons match the rest of the app's gold-outline SVG style instead of raw emoji.
  flag: { d: ['M5 3v18', 'M5 4h13l-3 4 3 4H5z'] },
  copy: { d: ['M6 15V6a2 2 0 012-2h9'] },
  share: { d: ['M12 15V4', 'M8 8l4-4 4 4', 'M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6'] },
  // Reader Font & Layout sheet: text-alignment picker.
  'align-left': { d: ['M4 6h16M4 12h10M4 18h14'] },
  'align-center': { d: ['M4 6h16M8 12h8M6 18h12'] },
  'align-right': { d: ['M4 6h16M10 12h10M6 18h14'] },
  'align-justify': { d: ['M4 6h16M4 12h16M4 18h16'] },
  // Settings: day/night/auto toggle.
  sun: { d: ['M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'] },
  moon: { d: ['M20 14.5A8.5 8.5 0 1110 3.2 6.8 6.8 0 0020 14.5z'] },
  'sun-moon-auto': { d: ['M12 3v18M6 6a8 8 0 000 12'] },
  // Half a sun on the horizon -- the one state the PWA's sprite sheet has no symbol for,
  // because only the mobile app exposes sunrise/sunset as a picker option.
  sunset: { d: ['M3 18h18', 'M12 3v3', 'M5.6 8.6l1.5 1.5', 'M18.4 8.6l-1.5 1.5', 'M7 18a5 5 0 0110 0'] },
  // A highlighter pen over the stroke it lays down. The two variants differ only in
  // whether the nib is filled, which is the whole state read: hollow marker = this text
  // is not highlighted, solid marker = it is.
  marker: { d: ['M15.2 3.4l5.4 5.4-7.6 7.6H7.6v-5.4z', 'M4 21h16'] },
  'marker-filled': { d: ['M15.2 3.4l5.4 5.4-7.6 7.6H7.6v-5.4z'], fill: true, extra: ['M4 21h16'] },
};

// Icons whose full outline is a single circle plus paths (react-native-svg needs
// <Circle> not a path arc command for these, matching the PWA's <circle> elements).
const CIRCLES: Record<string, { cx: number; cy: number; r: number }[]> = {
  search: [{ cx: 10, cy: 10, r: 6 }],
  eye: [{ cx: 12, cy: 12, r: 3 }],
  compass: [{ cx: 12, cy: 12, r: 9 }],
  gear: [{ cx: 12, cy: 12, r: 3.2 }],
  user: [{ cx: 12, cy: 8, r: 4 }],
  pin: [{ cx: 12, cy: 9, r: 4 }],
  sun: [{ cx: 12, cy: 12, r: 4 }],
};

const RECTS: Record<string, { x: number; y: number; w: number; h: number; rx?: number }[]> = {
  list: [{ x: 5, y: 4, w: 14, h: 17, rx: 2 }],
  books: [
    { x: 4, y: 15, w: 16, h: 4, rx: 1 },
    { x: 5, y: 10, w: 14, h: 4, rx: 1 },
    { x: 6, y: 5, w: 12, h: 4, rx: 1 },
  ],
  'book-closed': [{ x: 5, y: 4, w: 14, h: 16, rx: 1.5 }],
  mail: [{ x: 3, y: 5, w: 18, h: 14, rx: 2 }],
  lock: [{ x: 5, y: 11, w: 14, h: 9, rx: 2 }],
  copy: [{ x: 8, y: 8, w: 12, h: 12, rx: 1.5 }],
};

export default function Icon({ name, size = 18, color = '#c69a3a' }: { name: string; size?: number; color?: string }) {
  const spec = ICONS[name];
  if (!spec) return null;
  const strokeWidth = spec.strokeWidth ?? 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(RECTS[name] ?? []).map((r, i) => (
        <Path
          key={`r${i}`}
          d={roundedRectPath(r.x, r.y, r.w, r.h, r.rx ?? 0)}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ))}
      {(CIRCLES[name] ?? []).map((c, i) => (
        <Path
          key={`c${i}`}
          d={circlePath(c.cx, c.cy, c.r)}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ))}
      {spec.d.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={spec.fill ? color : 'none'}
        />
      ))}
      {(spec.extra ?? []).map((d, i) => (
        <Path
          key={`e${i}`}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
}

function roundedRectPath(x: number, y: number, w: number, h: number, rx: number): string {
  if (!rx) return `M ${x} ${y} h ${w} v ${h} h ${-w} z`;
  return `M ${x + rx} ${y} h ${w - 2 * rx} a ${rx} ${rx} 0 0 1 ${rx} ${rx} v ${h - 2 * rx} a ${rx} ${rx} 0 0 1 ${-rx} ${rx} h ${-(w - 2 * rx)} a ${rx} ${rx} 0 0 1 ${-rx} ${-rx} v ${-(h - 2 * rx)} a ${rx} ${rx} 0 0 1 ${rx} ${-rx} z`;
}
