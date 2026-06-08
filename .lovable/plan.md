# Boot polish: announcer VO + seamless ambience loop

Three focused changes to make the first-visit experience feel professional.

## 1. Announcer narrates the How-To-Play tips

Use the existing Elf/Persona ElevenLabs pipeline (`speakAsElf` in `src/lib/elf-voice.ts`, which hits `speakPersonaLine`) so the voice matches the in-game host and is cached server-side after the first generation.

- Add one continuous ~6-second line, e.g.:
  > "Here's the deal — answer fast, the score drops with the clock. Stack your two-times multiplier for the round that matters. And in the final drop, wager it all and steal the win."
- Trigger it the moment `BootSequence` enters the `tips` stage (inside the existing `useEffect` that already plays the `whoosh` on splash).
- Match stage duration to the voice line:
  - Keep the visual baseline at the current 6500ms.
  - On `tips` enter, start a Promise from `speakAsElf(...)`. When it resolves, then advance to `ready` — but never sooner than the 6500ms baseline (so the cards still get their full reveal even on cache hit / instant playback).
  - If a user gesture (key/click) fires the existing skip handler, also call `cancelElfSpeech()` so the line cuts cleanly.
- Leave splash/credits/ready stages unchanged.

## 2. Tap-to-play stage

No change — user confirmed the 12s auto-advance is correct.

## 3. Seamless crowd/chatter loop

The audible silence on `lobby-chatter` re-trigger comes from `HTMLAudioElement.loop = true`, which has a decode-gap between iterations (and the source mp3 itself can have trailing/leading silence). Switch the looped ambience layers to Web Audio's `AudioBufferSourceNode` with `loop = true`, which loops sample-accurately with no gap.

In `src/lib/ambience-engine.ts`:

- Add a lazy `AudioContext` (separate from `sound-engine`'s, or reuse it via a shared getter — separate is fine and avoids coupling).
- Replace the `chatter` and `crowd` layers' `HTMLAudioElement` with a small `BufferLayer` that:
  - Fetches the asset URL once, `decodeAudioData` into an `AudioBuffer` (cached module-level).
  - On `start*`, creates an `AudioBufferSourceNode` with `loop = true` connected through a `GainNode` for fade in/out, and starts it.
  - Tracks the active source so `stopLobbyBuildup` / `stopAllAmbience` can `stop()` it after a gain ramp.
- Keep `drum` and `cymbal` one-shots as `HTMLAudioElement` (no loop = no gap).
- Preserve the existing public API (`startLobbyChatter`, `startCrowd`, `stopLobbyBuildup`, `stopAllAmbience`, `setAmbienceMuted`, `climaxAndHandoff`, `resetAmbience`, `isAmbienceBlocked`, `onAmbienceBlockedChange`) and the gesture-gated autoplay retry contract — when `AudioContext.state === "suspended"` after `resume()`, surface `setBlocked(true)` so `useLobbyChatter` keeps retrying on user gestures, then `setBlocked(false)` once it resumes.
- Keep target volumes (`CHATTER_TARGET = 0.28`, `CROWD_TARGET = 0.18`) and fade durations identical so mix balance doesn't change.

## Technical notes

- `BootSequence` already has the timer/skip plumbing; the only addition is awaiting the VO promise (with a `Math.max(elapsed, 6500)` floor) before advancing out of `tips`.
- `speakAsElf` is already queued/cached; calling it once on tips-enter is safe and free after first generation (server caches in Supabase storage).
- Web Audio loop is the standard fix for mp3 loop-seam gaps; no asset re-export needed.
- No changes to `src/routes/index.tsx`, `src/routes/join.tsx`, `src/routes/host.tsx`, or the gesture-retry hook are required.

## Files touched

- `src/components/BootSequence.tsx` — trigger announcer VO on `tips`, gate advance on voice end (with 6.5s floor), cancel on skip.
- `src/lib/ambience-engine.ts` — swap looped layers (`chatter`, `crowd`) to Web Audio buffer sources for seamless loop; keep public API and blocked-state contract intact.
