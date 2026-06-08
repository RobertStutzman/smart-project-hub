## Goal

Make crowd ambience + drumroll actually play during the lobby/scan-code phase on the host screen, instead of silently being blocked by the browser.

## Problem

- On `/host`, `ambience-engine.startCrowd()` and `startDrumroll()` are called as soon as the room mounts. There has been no user gesture yet on that page, so `audio.play()` is blocked silently and you hear nothing until game-show music kicks in later (which only starts after the player join click chain unlocks audio).
- The "Host on this screen" click happens on `/`, not `/host` — that gesture does not carry over to the next page's `Audio` instances.

## Fix

1. **Pre-arm ambience on the landing-page click.**
   In `src/routes/index.tsx`, attach an `onClick` to the "Host on this screen" `<Link to="/host">` that, before navigation, calls `ambience-engine.startCrowd()` and schedules `startDrumroll()` ~1200ms later. Because this runs inside the click handler, the `Audio` elements are created under a valid user gesture and will continue playing across the route transition (same tab, same document).

2. **Make `/host` reuse the already-playing layers instead of restarting them.**
   `ambience-engine` already guards with `if (!crowd)` / `if (!drum)`, so the existing `useEffect` in `src/routes/host.tsx` becomes a no-op when layers are live. Keep the call as a fallback for users who land on `/host` directly (deep link, refresh).

3. **Fallback gesture-gate on `/host` for direct loads.**
   In `src/routes/host.tsx`, if `startCrowd()`'s underlying `audio.play()` was rejected (no prior gesture), register a one-shot `pointerdown`/`keydown` listener that retries `startCrowd()` + `startDrumroll()`. Mirror the pattern already in `src/routes/index.tsx`. Silent — no overlay, per your preference.

4. **No behavior change on game start.**
   `climaxAndHandoff()` still fades crowd + drum out when the game-show music takes over. `resetAmbience()` on lobby re-entry still works.

## Files touched

- `src/routes/index.tsx` — add click handler on the host CTA to start ambience pre-navigation.
- `src/routes/host.tsx` — keep auto-start, add silent gesture-gated retry if autoplay was blocked.
- `src/lib/ambience-engine.ts` — small change: have `startCrowd` / `startDrumroll` return a boolean (or expose an `isPlaying()` helper) so the host page knows whether to install the retry listener.

## Out of scope

- Landing page ambience on first load (already gesture-gated; leaving as-is).
- Join/player screens (no ambience there today).
- Visible "tap to enable sound" overlay (you chose silent gesture-gate).
