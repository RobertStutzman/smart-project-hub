## Problem

The Home Screen ambience is silent after returning from a finished game.

`src/lib/ambience-engine.ts` has a `handedOff` latch. When the game reaches the music drop, `HostGameStage.tsx:514` calls `climaxAndHandoff()`, which sets `handedOff = true`. After that, every `startLobbyChatter()` / `startCrowd()` / `startDrumroll()` early-returns `false` until something calls `resetAmbience()`.

`resetAmbience()` is only called from `/host` (lines 319, 367, 487 of `src/routes/host.tsx`). When the user navigates back to `/`, the home page mounts `useLobbyChatter`, which calls `startLobbyChatter()` directly — the latch is still tripped, so it silently returns `false`. No music.

## Fix

Call `resetAmbience()` before attempting to start chatter in the home screen's lobby hook. Two-line change in `src/hooks/use-lobby-chatter.ts`: inside the dynamic-import `.then((m) => …)`, call `m.resetAmbience()` once before the first `m.startLobbyChatter()` and inside `retry` before each retry attempt. This guarantees the latch is cleared whenever the user lands on `/`, regardless of how the previous game ended.

No change to game-flow code, no change to the handoff semantics on the host route — the latch still does its job during a live game.

## Out of scope

- No changes to `ambience-engine.ts` internals, volumes, or scheduling.
- No changes to the host route, game stage, or credits screen.
