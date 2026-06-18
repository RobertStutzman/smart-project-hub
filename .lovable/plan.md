## Goal

When the host presses "End · new room" mid-game (or the dev parent posts `parent:new-room`), the app should:
1. Kill every audio surface — ElevenLabs announcer queue, end-game music, credits bed, wager bed, question bed, boot music, funny SFX — instantly, and refuse to play any further end-game audio.
2. Skip the Game Recap / credits / final scoreboard entirely and snap back to the lobby on this device.

Today both flows do call `cancelElfSpeech` + `silenceAllAudio` + `stopAllAmbience`, **but** they `await endRoomFn` before flipping local state, so during the await:
- The server sets `phase = "ended"`, realtime arrives, `HostGameStage` mounts/keeps running and schedules a 20s "auto-roll credits" timer and end-game persona lines.
- New `speakAsElf` / `playEvent` calls made by those effects land **after** our cancel, so the announcer fires anyway.

Also `silenceAllAudio()` misses `stopBootMusic`.

## What changes

**1. `src/routes/host.tsx` — `endAndStartNewRoom` (lines ~702–731)**

Reorder + harden:
- Confirm prompt first.
- **Immediately** `setRoomPhase("lobby")` and `setPlayers([])` so `HostGameStage` unmounts on the next render, cleaning up all its effects/timers before any new audio can queue.
- Cancel speech, call `silenceAllAudio()`, `stopAllAmbience()`, `resetAmbience()`.
- Schedule a second cancel/silence sweep at ~250ms and ~700ms (handles late tasks that were already mid-flight on dynamic import resolution).
- Then `await endRoomFn(...)`, then `createRoomFn(...)`, then set the new room. Wrap both server calls in try/catch so audio stays silenced even if either fails.
- Restart only the lobby crowd ambience (already handled by the lobby effect on remount).

**2. `src/routes/host.tsx` — `parent:new-room` listener (lines ~322–352)**

Apply the exact same reordering: flip local state to lobby first, then cancel/silence (twice), then end + create room.

**3. `src/lib/sound-engine.ts` — `silenceAllAudio()` (line ~746)**

Add `stopBootMusic(0)` so the boot/intro bed cannot bleed past a reset. (It's already exported and called by `stopOtherMusic`.)

**4. `src/lib/elf-voice.ts` — small guard**

Add an exported `silenceFor(ms: number)` that bumps `generation`, drops the queue, and sets a short window during which new `speakAsElf` / `playVoiceUrl` calls return immediately. Call it from the host reset with `silenceFor(1500)` so any persona-live / orchestrator callbacks that fire during the ~1s server round-trip are no-ops instead of getting queued.

## Technical details / non-goals

- No server-side change. `endRoom` still marks the room `ended`; we just stop reacting to that on the host device.
- `HostGameStage` unmount happens because `host.tsx` gates it on `roomPhase !== "lobby"`. Flipping local state first guarantees its effects/timers (the 20s `phase==="ended" → credits` setTimeout, the final-question persona reactions, etc.) tear down before they can schedule more audio.
- Other clients (players, audience view) still see the room end naturally — this is a host-device-only kill switch, which matches the existing behavior.
- No UI change to the "End · new room" button itself.

## Files touched

- `src/routes/host.tsx`
- `src/lib/sound-engine.ts`
- `src/lib/elf-voice.ts`
