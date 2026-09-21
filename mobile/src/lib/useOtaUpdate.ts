import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Over-the-air updates.
//
// This is what makes "changes arrive without reinstalling" true for the native app. JS,
// styles, images and every screen in src/ ship this way. What CANNOT is anything native --
// a new Expo module, a config plugin, a permission -- because those are compiled into the
// APK. Adding one means a new build and a manual install, and there is no way around that.
//
// expo-updates already fetches on launch (checkAutomatically: ON_LOAD in app.json), but it
// applies what it fetched on the NEXT launch. That is the wrong shape for a writing app you
// leave open for hours: the update would sit there unused until you happened to force-quit.
// So this checks again on demand and offers to reload once one is ready.
//
// LAUNCH DOES NOT WAIT for that fetch any more. fallbackToCacheTimeout was 8000, which held
// the splash for up to 8s on every cold start while the server was asked -- and after the
// phone had been idle a while, with the radio asleep, it used most of that. That was "the
// lag when I haven't used the app for a while" (2026-09-21). It is 0 now: the app starts at
// once from the bundle it has, expo-updates downloads anything newer in the background, and
// this hook is what surfaces it. Which is why it also checks on RESUME, not only 4s after
// launch: a session that lives for days still hears about updates.

export type OtaState = {
  /** An update has been downloaded and will apply on reload. */
  ready: boolean;
  checking: boolean;
  /** Null in development, where updates are disabled and every check is a no-op. */
  enabled: boolean;
  check: () => Promise<void>;
  apply: () => Promise<void>;
};

export function useOtaUpdate(): OtaState {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);

  // Updates.isEnabled is false in Expo Go and in dev builds. Guarding on it keeps the whole
  // thing silent during development instead of throwing on every check.
  const enabled = Updates.isEnabled;

  const check = useCallback(async () => {
    if (!enabled || checking) return;
    setChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setReady(true);
      }
    } catch {
      // Offline, or the update server is unreachable. Neither is worth interrupting writing
      // over -- the app keeps running whatever it already has, which is the entire point of
      // shipping the bundle with the binary.
    } finally {
      setChecking(false);
    }
  }, [enabled, checking]);

  const apply = useCallback(async () => {
    if (!ready) return;
    // Restarts into the downloaded bundle. Everything the writer has typed is already in
    // Supabase by this point -- the editor autosaves -- but this is still only ever offered,
    // never done automatically, because a reload mid-sentence is indistinguishable from a
    // crash.
    await Updates.reloadAsync();
  }, [ready]);

  useEffect(() => {
    // One check shortly after launch, on top of the automatic one, so a session that starts
    // offline still picks up an update once the network returns -- and one on every return
    // to the foreground, since launch no longer waits for the server.
    const id = setTimeout(check, 4000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [check]);

  return { ready, checking, enabled, check, apply };
}
