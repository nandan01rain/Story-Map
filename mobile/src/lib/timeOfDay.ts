import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

// Time-of-day resolution for the app's three visual modes, ported from the PWA
// (index.html's calcSunTimes/resolveTimeMode block). Real astronomical sunrise/sunset
// from the standard NOAA/Schlyter solar-position equations (public domain), computed
// locally -- no API, no key.
//
// Coordinates: the PWA reads navigator.geolocation and caches the result. Nothing here
// asks for a device location yet (that needs expo-location, a native module, and a
// permission prompt on first launch), so this currently always takes the PWA's own
// geolocation-denied path -- a fixed 6:30/18:30 local-clock day. calcSunTimes is ported
// in full and wired up behind setCoords() so switching to real coordinates later is one
// call, not a rewrite.
export type TimeOfDay = 'day' | 'sunset' | 'night';

export function calcSunTimes(date: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } {
  const rad = Math.PI / 180;
  const msPerDay = 86400000;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const toJulian = (d: Date) => d.valueOf() / msPerDay - 0.5 + J1970;
  const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * msPerDay);
  const toDays = (d: Date) => toJulian(d) - J2000;
  const e = rad * 23.4397; // obliquity of the ecliptic
  const declination = (l: number, b: number) =>
    Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
  const eclipticLongitude = (M: number) => {
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const P = rad * 102.9372; // perihelion of Earth
    return M + C + P + Math.PI;
  };
  const julianCycle = (d: number, lw: number) => Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const approxTransit = (Ht: number, lw: number, n: number) => 0.0009 + (Ht + lw) / (2 * Math.PI) + n;
  const solarTransitJ = (ds: number, M: number, L: number) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const hourAngle = (h: number, phi: number, d: number) =>
    Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const h0 = -0.83 * rad; // accounts for atmospheric refraction + the solar disc's radius
  const w = hourAngle(h0, phi, dec);
  const Jnoon = solarTransitJ(ds, M, L);
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
}

function clockFallbackSunTimes(date: Date): { sunrise: Date; sunset: Date } {
  const sunrise = new Date(date);
  sunrise.setHours(6, 30, 0, 0);
  const sunset = new Date(date);
  sunset.setHours(18, 30, 0, 0);
  return { sunrise, sunset };
}

// ~1hr transition window in total, centered on sunrise and again on sunset -- the window
// where the scene reads as sunrise/sunset rather than flat day or night.
const TRANSITION_HALF_MS = 30 * 60 * 1000;
const RECHECK_INTERVAL_MS = 60_000;

let coords: { lat: number; lon: number } | null = null;
export function setCoords(lat: number, lon: number) {
  coords = { lat, lon };
}

export function resolveTimeMode(sunrise: Date, sunset: Date, now = Date.now()): TimeOfDay {
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  if (Math.abs(now - sr) <= TRANSITION_HALF_MS || Math.abs(now - ss) <= TRANSITION_HALF_MS) return 'sunset';
  return now > sr && now < ss ? 'day' : 'night';
}

export function resolveCurrentTimeMode(): TimeOfDay {
  const now = new Date();
  const times = coords ? calcSunTimes(now, coords.lat, coords.lon) : clockFallbackSunTimes(now);
  return resolveTimeMode(times.sunrise, times.sunset);
}

// Re-checks once a minute so the scene actually turns over at sunrise/sunset without the
// app having to be relaunched, the same way the theme's own auto mode does.
export function useTimeOfDay(): TimeOfDay {
  const [mode, setMode] = useState<TimeOfDay>(resolveCurrentTimeMode);
  useEffect(() => {
    const id = setInterval(() => setMode(resolveCurrentTimeMode()), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return mode;
}

// The manual override, mirroring the PWA's #authscene-select: 'auto' follows real time,
// any other value pins the scene to that one. Kept in AsyncStorage rather than the
// account, because the sign-in screen has to pick its scene before anyone is signed in --
// same reason the PWA reads this from localStorage rather than user_metadata.
//
// A plain module-level store with subscribers, not React context: Settings and the
// sign-in screen sit in different parts of the tree and neither is a child of the other,
// and this is a single enum that changes about once a session.
export type ScenePreference = TimeOfDay | 'auto';
export const SCENE_PREFERENCES: { value: ScenePreference; label: string }[] = [
  { value: 'auto', label: 'Follow time' },
  { value: 'day', label: 'Day' },
  { value: 'sunset', label: 'Sunrise & sunset' },
  { value: 'night', label: 'Night' },
];
const SCENE_STORAGE_KEY = 'auth-scene-mode';

function isScenePreference(value: unknown): value is ScenePreference {
  return value === 'auto' || value === 'day' || value === 'sunset' || value === 'night';
}

let scenePreference: ScenePreference = 'auto';
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hydrateScenePreference() {
  if (hydrated) return;
  hydrated = true;
  AsyncStorage.getItem(SCENE_STORAGE_KEY).then((saved) => {
    if (isScenePreference(saved)) {
      scenePreference = saved;
      emit();
    }
  });
}

export function setScenePreference(next: ScenePreference) {
  scenePreference = next;
  AsyncStorage.setItem(SCENE_STORAGE_KEY, next);
  emit();
}

export function useScenePreference(): ScenePreference {
  useEffect(hydrateScenePreference, []);
  return useSyncExternalStore(subscribe, () => scenePreference);
}

// What every surface that draws a scene should read: the override when one is set, the
// real time of day otherwise.
export function useSceneMode(): TimeOfDay {
  const preference = useScenePreference();
  const byTime = useTimeOfDay();
  return preference === 'auto' ? byTime : preference;
}
