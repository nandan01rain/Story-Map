import { Circle, G, Path, Svg } from 'react-native-svg';

// The drawer's ornaments, drawn rather than imported.
//
// What the plates do not already carry is line work -- a star, a section glyph per group, a
// chevron. (The compass rose, corner brackets and diamond rule that used to live here are
// painted into the supplied header plates now, and were removed 2026-09-24.) All of it is
// vector, all of it is one stroke colour, and `react-native-svg` is already a
// dependency (Icon.tsx re-renders the PWA's <symbol> paths the same way). So none of it needs
// an asset, none of it needs a rebuild, and all of it recolours with the theme.
//
// What is NOT here, because it cannot be drawn from a description: the illustrated city at
// the foot of the panel. That is real artwork and has to arrive as a file. The drawer is
// built so it slots in underneath without anything else moving -- see DrawerFooterArt.

/** A four-point star, the same mark the PWA uses as --flourish. Corners and rule centres. */
export function Flourish({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path
        d="M20 2 L23.5 16.5 L38 20 L23.5 23.5 L20 38 L16.5 23.5 L2 20 L16.5 16.5 Z"
        fill={color}
      />
    </Svg>
  );
}

/** Section glyphs: a compass for Discover, stacked books for Manage, a quill for Assist. */
export function SectionGlyph({ name, color, size = 26 }: { name: SectionGlyphName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <G stroke={color} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {name === 'discover' && (
          <>
            <Circle cx={16} cy={16} r={12} />
            <Path d="M16 4 l1.6 9.2 L16 16 l-1.6 -2.8 Z" />
            <Path d="M16 28 l1.6 -9.2 L16 16 l-1.6 2.8 Z" />
            <Circle cx={16} cy={16} r={1.8} fill={color} stroke="none" />
          </>
        )}
        {name === 'manage' && (
          <>
            <Path d="M4 22 h20 a2 2 0 0 1 2 2 H6 a2 2 0 0 0 -2 -2 Z" />
            <Path d="M5 17 h20 a2 2 0 0 1 2 2 H7 a2 2 0 0 0 -2 -2 Z" />
            <Path d="M6 12 h20 a2 2 0 0 1 2 2 H8 a2 2 0 0 0 -2 -2 Z" />
          </>
        )}
        {/* The quill moved from Assist to Write when Write became a section (2026-09-21):
            it is the writing mark. Assist takes a star. */}
        {name === 'write' && (
          <>
            <Path d="M5 27 c8 -1.5 13.5 -5.5 17 -12 2.1 -3.6 2.9 -6.6 3.2 -9.4 -2.7 0.3 -5.7 1.1 -9.3 3.2 -6.5 3.9 -10.5 9.4 -12 17 Z" />
            <Path d="M5 27 l8 -8" />
          </>
        )}
        {name === 'assist' && (
          <>
            <Path d="M16 4 l2.6 7.4 L26 14 l-7.4 2.6 L16 24 l-2.6 -7.4 L6 14 l7.4 -2.6 Z" />
            <Path d="M24 22 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z" />
          </>
        )}
      </G>
    </Svg>
  );
}

export type SectionGlyphName = 'write' | 'discover' | 'manage' | 'assist';

/** A chevron, replacing the small filled triangle. */
export function Chevron({ color, size = 16, open }: { color: string; size?: number; open?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={open ? 'M6 15 L12 9 L18 15' : 'M9 5 L16 12 L9 19'}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
