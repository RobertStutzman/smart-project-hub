## Goal

When the host returns from credits/ended back to the QR lobby (Play Again, or any path that drops phase back to `lobby` after a finished game), give the announcer a silent beat and skip the re‑welcome chatter — players are still in the room and don't need another opener.

## Changes

### 1. Track "this is a replay, not a fresh room" in `src/components/host/HostGameStage.tsx`

Add a `playedOnceRef` that flips true the first time `state.phase` leaves `lobby`. When we return to `lobby` with that flag set, treat it as a replay lobby:

- Hard cancel speech on the transition:
  - `import("@/lib/elf-voice").then(m => m.cancelElfSpeech())`
  - `import("@/lib/host-persona").then(m => m.cancelPersona?.())` (if present; otherwise fall back to `cancelElfSpeech` only)
- Reset the per‑game refs so a future game still gets fresh callouts on its own round 1:
  - `welcomeFiredRef.current = false`
  - `finalShowdownFiredRef.current = false`
  - `lastRoundStingKeyRef.current = ""`
- Set a window‑scoped flag `window.__btdReplayLobby = true` (cleared once consumed) so the lobby‑banter effect in `src/routes/host.tsx` can see it on the next render.

### 2. Quiet the replay lobby in `src/routes/host.tsx`

In the existing lobby‑announcer effect (the one that fires `speakOpener` at +2.4s and a quip every 10s):

- On entry, read+clear `window.__btdReplayLobby`. If true:
  - Skip the opener entirely.
  - Delay the rotating quip interval start by ~12s and stretch the cadence to ~25s for this lobby session (so it's a near‑silent bed; players aren't being re‑pitched the join instructions).
  - Also call `cancelElfSpeech()` once on mount to drain any leftover credits/persona TTS that beat the cancel in step 1.

Fresh lobbies (first time `/host` opens for a brand‑new room) keep the current opener + 10s cadence.

### 3. Ambience handoff cleanup in `HostGameStage.tsx`

The existing `state.phase === "lobby" && ambienceHandedRef.current` branch already resets ambience on Play Again. Add a tiny silent beat:

- Before `resetAmbience()` / `startCrowd()`, call `stopMusic()` and wait ~600ms via a `setTimeout` before `startMusic("lobby", 1200)` (longer fade in for the replay).

This produces the "silent beat → quiet lobby" feel the user picked.

## Out of scope

- No "Rematch!" splash card (user picked silent option).
- No changes to the player‑side flow — players stay joined and see whatever the host route normally shows.
- No changes to the credits stage itself; it already cancels speech and music on Play Again.

## Technical notes

- `cancelElfSpeech` exists in `src/lib/elf-voice.ts` and is the canonical "shut up now" call. If `host-persona` doesn't export a cancel, it ultimately routes through elf‑voice so the single cancel still drains it.
- Using a `window.__btdReplayLobby` boolean (rather than React state) avoids cross‑component prop plumbing for a one‑shot signal; it's cleared on read so it can't leak into a later session.
