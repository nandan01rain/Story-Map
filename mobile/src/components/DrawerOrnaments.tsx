import { Circle, G, Line, Path, Svg } from 'react-native-svg';

// The drawer's ornaments, drawn rather than imported.
//
// Everything ornamental in the reference is line work -- a compass rose, corner flourishes,
// rules with a diamond at their centre, a section glyph per group, a double-ruled frame. All
// of it is vector, all of it is one stroke colour, and `react-native-svg` is already a
// dependency (Icon.tsx re-renders the PWA's <symbol> paths the same way). So none of it needs
// an asset, none of it needs a rebuild, and all of it recolours with the theme.
//
// What is NOT here, because it cannot be drawn from a description: the illustrated city at
// the foot of the panel. That is real artwork and has to arrive as a file. The drawer is
// built so it slots in underneath without anything else moving -- see DrawerFooterArt.

/** The compass rose. Eight points, the cardinals long and the ordinals short. */
export function CompassRose({ size = 96, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G stroke={color} strokeWidth={1.1} fill="none" strokeLinejoin="round">
        {/* Cardinal points: long, narrow kites. */}
        <Path d="M50 6 L56 44 L50 50 L44 44 Z" />
        <Path d="M50 94 L56 56 L50 50 L44 56 Z" />
        <Path d="M6 50 L44 44 L50 50 L44 56 Z" />
        <Path d="M94 50 L56 44 L50 50 L56 56 Z" />
        {/* Ordinals: shorter, at 45 degrees. */}
        <Path d="M22 22 L47 43 L43 47 Z" />
        <Path d="M78 22 L57 43 L53 47 Z" />
        <Path d="M22 78 L43 57 L47 53 Z" />
        <Path d="M78 78 L57 57 L53 53 Z" />
        <Circle cx={50} cy={50} r={9} />
        <Circle cx={50} cy={50} r={2.4} fill={color} />
        {/* The small attendant stars the reference sets either side of the rose. */}
        <Path d="M14 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill={color} strokeWidth={0.4} />
        <Path d="M86 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill={color} strokeWidth={0.4} />
      </G>
    </Svg>
  );
}

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

/** A corner bracket: two nested right angles with a tick, mirrored by the `corner` prop. */
export function CornerFlourish({
  size = 34,
  color,
  corner,
}: {
  size?: number;
  color: string;
  corner: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const flipX = corner === 'tr' || corner === 'br';
  const flipY = corner === 'bl' || corner === 'br';
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <G
        stroke={color}
        strokeWidth={1}
        fill="none"
        transform={`translate(${flipX ? 40 : 0}, ${flipY ? 40 : 0}) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`}
      >
        <Path d="M2 14 L2 2 L14 2" />
        <Path d="M6 20 L6 6 L20 6" />
        <Circle cx={6} cy={6} r={1.6} fill={color} stroke="none" />
      </G>
    </Svg>
  );
}

/** A hairline with a diamond at its middle — the reference's section divider. */
export function OrnamentRule({ color, width = 1 }: { color: string; width?: number }) {
  return (
    <Svg height={12} width="100%" viewBox="0 0 300 12" preserveAspectRatio="none">
      <Line x1={0} y1={6} x2={132} y2={6} stroke={color} strokeWidth={width} />
      <Path d="M150 1 l5 5 -5 5 -5 -5 Z" fill={color} />
      <Line x1={168} y1={6} x2={300} y2={6} stroke={color} strokeWidth={width} />
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
        {name === 'assist' && (
          <>
            <Path d="M5 27 c8 -1.5 13.5 -5.5 17 -12 2.1 -3.6 2.9 -6.6 3.2 -9.4 -2.7 0.3 -5.7 1.1 -9.3 3.2 -6.5 3.9 -10.5 9.4 -12 17 Z" />
            <Path d="M5 27 l8 -8" />
          </>
        )}
      </G>
    </Svg>
  );
}

export type SectionGlyphName = 'discover' | 'manage' | 'assist';

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
