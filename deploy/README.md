# Deployment

Two halves, two mechanisms, one shared Supabase project. Sync between devices already works
and needs nothing — both apps read the same tables. What follows is only about *distribution*.

The rule that governs everything below: **JavaScript ships over the air, native code does
not.** Screens, styles, logic and images reach an installed app without reinstalling it.
A new native module, a config plugin or a permission is compiled into the binary and needs a
new build.

---

## 1. The PWA — desktop, laptop, any browser

### One-time setup

`github-pages-workflow.yml` in this folder publishes the site on every push to `main`. It is
**not** at `.github/workflows/` because the credential this repo was pushed with lacks
GitHub's `workflow` scope, and GitHub refuses to accept workflow files from a token without
it. Either:

- **Move it yourself.** In GitHub's web UI: *Add file → Create new file*, path
  `.github/workflows/deploy-pwa.yml`, paste this file's contents, commit. The web UI is not
  subject to the token's scope.
- **Or re-authenticate** with `workflow` scope, then
  `git mv deploy/github-pages-workflow.yml .github/workflows/deploy-pwa.yml` and push.

Then in the repo: **Settings → Pages → Source → GitHub Actions**.

The site lands at `https://nandan01rain.github.io/Story-Map/`.

### Installing it

Chrome or Edge on Windows/macOS shows an **Install** button in the address bar — that gives
a real app window with its own icon and taskbar entry. Android Chrome offers *Add to Home
Screen*. iOS Safari does too, with more limitations.

### How updates reach you

Push to `main` → the workflow republishes → the next time you open the app you have it. The
service worker is **network-first for the app shell**, so it fetches the current version and
falls back to cache only when offline. No reinstall, no cache-clearing.

---

## 2. The Android app — the Samsung M34

### One-time setup

```bash
npm install -g eas-cli
eas login                 # your Expo account
cd mobile
eas init                  # creates the EAS project and fills in the id
```

`eas init` replaces both `REPLACE_WITH_EAS_PROJECT_ID` placeholders in `mobile/app.json`
(`updates.url` and `extra.eas.projectId`). Nothing works until it has.

### The three build profiles

`eas.json` has no comments in it — EAS validates that file against a strict schema and
rejects unknown keys, including the `"//"` convention JSON tolerates elsewhere. So the
explanations live here:

| Profile | Output | Channel | For |
|---|---|---|---|
| `preview` | `.apk` | `preview` | Your own phone. Installs directly, no store. |
| `production` | `.aab` | `production` | The day this goes to the Play Store. Its own channel, so a store build can never pick up an update meant for your pocket. |
| `development` | `.apk` + dev client | — | Attaching the Metro bundler when a native module misbehaves and Expo Go cannot load it. Not needed normally. |

`distribution: "internal"` on preview is what makes EAS give you an install URL instead of
preparing a store submission.

### Build the APK

```bash
cd mobile
eas build --platform android --profile preview
```

Builds on Expo's servers — nothing needs installing locally. It prints a URL; open it on the
phone and install. Android will warn about installing outside the Play Store; that is
expected for a personal build.

**Free.** No Play Store account, no annual fee. That is the Android path; iOS would need the
Apple Developer Program at $99/yr.

### Ship an update without reinstalling

```bash
cd mobile
eas update --branch preview --message "what changed"
```

Seconds, not minutes — it uploads a JS bundle, not a binary. The app checks on launch and
again a few seconds in, then offers **"An update is ready — tap to restart"**. It is offered
rather than taken: a reload mid-sentence is indistinguishable from a crash.

### When a new APK *is* required

Any change to native code. In practice:

- adding an Expo module (`expo-camera`, another `expo-*`)
- adding or changing a config plugin — `app.json`'s `plugins` array
- new permissions
- an Expo SDK upgrade
- changing `app.json` identifiers, icons or the splash screen

Everything else — every screen, every store, the character web, the theme, the EPUB builder —
goes over the air.

The last build's native surface: `expo-font`, `expo-web-browser`, `expo-sharing`,
`expo-updates`, plus `jszip` (pure JS, ships OTA), `expo-file-system`,
`react-native-worklets`, `react-native-reanimated`, `react-native-gesture-handler`,
`react-native-webview`.

---

## Before every build

```bash
cd mobile && npx expo-doctor
```

It should say **21/21**. It caught a missing `react-native-worklets` peer dependency during
setup — the kind of fault that works perfectly in Expo Go and crashes a standalone build,
which you would otherwise only discover after installing.

## Still outstanding

- **Four database migrations are unrun.** Each supersedes the last, so paste only
  `supabase/migrations/20260824_graph_pairs.sql` into the Supabase SQL Editor. Until then the
  character web's Plants & Reveals, Structure and Threads layers return nothing.
- **`assets/` is ~7 MB**, mostly uncompressed sign-in art. It does not block anything, but it
  is most of the PWA's download.
