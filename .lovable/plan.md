## Goal
Get the app Play Store ready by wrapping the existing PWA as a Trusted Web Activity (TWA), and remove the audio gate inside that wrapped app so the announcer + crowd start the moment the app opens.

## Approach
Your site is already a valid installable PWA (manifest + icons + standalone). The shortest path to Google Play is a TWA built with Bubblewrap — it produces a signed `.aab` you upload to Play Console. The TWA launches in `display-mode: standalone`, which both unlocks Chrome's autoplay policy and lets us skip the gate.

## Changes

### 1. Skip the gate in installed / TWA mode (`src/components/BootSequence.tsx`)
- On mount, detect standalone launch:
  - `window.matchMedia('(display-mode: standalone)').matches` (Android PWA, TWA, Chrome installed)
  - `navigator.standalone === true` (iOS home-screen PWA)
- If either is true: initial stage = `splash` (not `gate`), and immediately call `startLobbyChatter()` + `prewarmElfLines([TIPS_VO], "hype")` on mount.
- Browser-tab visitors still see the gate (Chrome will reject autoplay there — unavoidable).

### 2. Digital Asset Links for TWA verification
- Add `public/.well-known/assetlinks.json` as a placeholder. This file is REQUIRED for the TWA to launch full-screen without a Chrome address bar on the user's device. It needs the SHA-256 fingerprint of the Play-signed APK, which Google generates after the first upload.
- I'll add the file with a clearly-marked `REPLACE_WITH_SHA256_FROM_PLAY_CONSOLE` placeholder and a comment in the plan telling you how to fill it in.

### 3. Manifest polish for Play Store (`public/manifest.webmanifest`)
- Add `id: "/"` (required by Play to keep the install identity stable).
- Add `categories: ["games", "entertainment"]`.
- Change `orientation` from `any` to `portrait` or `landscape` — Play asks for one. I'll default to `any` staying since you support both, but flag this in case you want to lock orientation.

## What you do after I make the code changes

1. Install Bubblewrap once on your machine:
   `npm i -g @bubblewrap/cli`
2. From any folder, run:
   `bubblewrap init --manifest=https://droptrivia.app/manifest.webmanifest`
   It will ask for app name, package id (e.g. `app.droptrivia.twa`), display mode, etc.
3. Build the bundle:
   `bubblewrap build` → produces `app-release-bundle.aab`.
4. In Play Console → create app → upload the `.aab`. Play Console will show you a SHA-256 fingerprint under **Setup → App integrity**.
5. Paste that fingerprint into `public/.well-known/assetlinks.json` (replacing the placeholder), then publish the web update. Without this step the TWA shows a browser URL bar.

## What is NOT in scope
- No Capacitor / native code path. TWA wraps the existing PWA — no separate codebase, no React Native, no rebuilds when you ship web updates.
- No offline mode / service worker. Per Lovable PWA rules we only need manifest-based installability for this case.
- No iOS App Store work — that requires a different path (Capacitor or PWABuilder for iOS) and is a separate decision.

## Notes
- Inside the TWA running from Play Store, the announcer + crowd will play immediately with no tap — exactly what you wanted.
- On the public droptrivia.app browser link, the "Tap to begin" gate stays as a fallback for one-off web visits.
