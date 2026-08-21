import Svg, { Path, Rect } from 'react-native-svg';

// The three OAuth marks, same paths as the PWA's sign-in screen (index.html's
// #auth-oauth-list). All drawn into a single 17x17 box regardless of their native
// viewBoxes, so the three sit on one shared baseline instead of each drifting to its own
// icon's size.
const SIZE = 17;

export function GoogleMark() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function AppleMark() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M16.365 1.43c0 1.14-.462 2.16-1.235 2.94-.833.85-2.19 1.51-3.24 1.42-.14-1.1.44-2.24 1.18-2.99.82-.85 2.27-1.5 3.29-1.37zM20.87 17.34c-.53 1.22-.78 1.77-1.46 2.85-.95 1.5-2.29 3.37-3.95 3.39-1.47.02-1.85-.96-3.85-.95-2 .01-2.42.97-3.89.95-1.66-.02-2.93-1.71-3.88-3.2-2.66-4.17-2.94-9.06-1.3-11.67 1.16-1.85 3-2.94 4.73-2.94 1.76 0 2.87 1 4.33 1 1.41 0 2.28-1 4.33-1 1.54 0 3.17.84 4.33 2.28-3.81 2.09-3.19 7.53.61 9.29z"
      />
    </Svg>
  );
}

export function MicrosoftMark() {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24">
      <Rect x={1} y={1} width={10} height={10} fill="#F25022" />
      <Rect x={13} y={1} width={10} height={10} fill="#7FBA00" />
      <Rect x={1} y={13} width={10} height={10} fill="#00A4EF" />
      <Rect x={13} y={13} width={10} height={10} fill="#FFB900" />
    </Svg>
  );
}
