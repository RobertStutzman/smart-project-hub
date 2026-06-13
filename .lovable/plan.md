## Problem

On the host QR-code lobby, the crowd background plays one cycle of the seamless WAV (~26s) and then goes silent for the rest of the lobby.

## Root cause

The lobby crowd bed runs through a custom Web Audio scheduler in `src/lib/ambience-engine.ts` (`pumpScheduler` + crossfaded `AudioBufferSourceNode`s). Three weaknesses combine into "plays once, then dies":

1. The scheduler is a chain of `setTimeout(2s)` calls. If the AudioContext suspends (preview tab loses focus, OS audio policy quirk) the queued sources finish and nothing requeues them — no watchdog.
2. `setAmbienceMuted(false)` only flips the flag; it does NOT restart layers in the `wanted` set. Any transient mute (including the global mute mirror from `sound-engine.setMuted`) kills the lobby bed permanently.
3. No `visibilitychange` recovery — after a tab refocus the suspended ambience context never gets a fresh `resume()`.

The seamless WAV genuinely loops cleanly (it was authored for `HTMLAudioElement.loop`), so the elaborate crossfade scheduler is buying nothing for this layer.

To answer "why did you turn it off" — I didn't deliberately. The scheduler-based loop stops itself when the AudioContext drops out, and the engine has no code path to bring it back. That gap is what this fix closes.

## Fix

Make the lobby crowd bed bulletproof. All work in `src/lib/ambience-engine.ts` with one small touch in `src/routes/__root.tsx`:

1. Add a parallel `HtmlLayer` backend that wraps a lazily-created `<audio>` element with `loop = true`, `preload = "auto"`, target volume, and a duck multiplier. Switch the `chatter` and `crowd` layers to use it. Keep the existing `LoopLayer` (Web Audio crossfade scheduler) for `drumroll`, which has a silent tail and genuinely needs it.
2. Update `startCrowd` / `startLobbyChatter` / `stopAllAmbience` / `stopLobbyBuildup` / `duckAmbience` / `unduckAmbience` to dispatch to the right backend per layer.
3. `setAmbienceMuted(false)` re-arms anything in `wanted` (re-call the appropriate start fn).
4. Add a `visibilitychange` + global gesture watchdog (registered once, lazily on first start): on tab refocus call `resumeAmbienceContext()` and, if any HtmlLayer is wanted and `audio.paused`, call `audio.play()`. Extend `retryBlockedAmbience()` to do the same for the html backend.
5. In `src/routes/__root.tsx`, the existing gesture-unlock effect already calls `retryBlockedAmbience()`; just add a single `document.addEventListener("visibilitychange", ...)` that re-runs the unlock routine when the page becomes visible again.

## Out of scope

- Drumroll layer (keeps the crossfade scheduler).
- Sound-engine music handling.
- New assets.
- HostGameStage handoff logic (`climaxAndHandoff` still ends the bed when the game starts, unchanged).

## Files touched

```text
src/lib/ambience-engine.ts   (most of the work)
src/routes/__root.tsx        (small: add visibilitychange to the existing unlock effect)
```

## Verification

- Open host preview, create a room, watch the QR lobby for ~90s — crowd bed keeps going past the 26s mark.
- Toggle mute on then off — bed comes back without a refresh.
- Switch browser tabs away for 30s, return — bed resumes within ~1s.
- Start the game from the lobby — cymbal swell + bed stop still fire as before via `climaxAndHandoff`.
