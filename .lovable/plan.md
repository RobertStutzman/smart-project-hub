## Problem

On `/host` the crowd/lobby ambience only starts once, in an effect keyed on `room?.id`. It gets torn down whenever:
- `climaxAndHandoff()` fires when the game starts (expected), but if the host returns to the lobby of the **same room** (Play Again / phase → lobby), `handedOff` stays true and no code restarts ambience.
- The initial `startCrowd()` is blocked by autoplay on TV browsers (Samsung Tizen, Amazon Silk, iPad screen mirroring). The `__root.tsx` gesture listener retries, but on a QR-code lobby the host often never taps the TV screen, so ambience never unlocks.
- After `stopLobbyBuildup()` runs in the effect cleanup, `wanted` no longer contains `"crowd"`, so `retryBlockedAmbience()` becomes a no-op even when a gesture later occurs.

## Fix

1. **Restart ambience whenever the host enters/returns to the lobby.** Change the ambience effect in `src/routes/host.tsx` (currently lines ~381-416) to depend on `[room?.id, roomPhase]`, gated by `roomPhase === "lobby"`. Call `resetAmbience()` before `startCrowd()` so the handoff latch from a previous game is cleared. This covers first-mount, new-room, and Play-Again returns.

2. **Retry ambience on any user gesture on the host lobby**, mirroring what `useLobbyChatter` does for `/` and `/join`. Add a small effect on `/host` (or reuse a trimmed version of the existing hook, crowd-only) that:
   - listens for `pointerdown` / `keydown` / `touchstart` while the host is in the lobby,
   - calls `resetAmbience()` + `startCrowd()` on each gesture until one resolves `true`,
   - detaches once playing.
   This makes the ambience come back on the first click on the "Start Game" button / QR area for autoplay-blocked TV browsers.

3. **Keep the crowd layer "wanted" while in lobby.** The current effect-cleanup calls `stopLobbyBuildup()` which removes `"crowd"` from `wanted`. Only call that on unmount when leaving lobby (i.e. `roomPhase !== "lobby"`); when only `room.id` changes between lobbies, do nothing so the global gesture-unlock retry stays effective.

No changes to `ambience-engine.ts`, other routes, or game logic. Purely host-lobby wiring so the crowd bed is audible from room creation through game start on every browser, and comes back after Play Again.

## Files touched

- `src/routes/host.tsx` — retune the ambience `useEffect` and add a gesture-retry effect scoped to `roomPhase === "lobby"`.
