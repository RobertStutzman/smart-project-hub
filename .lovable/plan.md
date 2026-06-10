## Plan

Remove the lobby prewarm I just added. It silences the announcer for the whole game because each prewarm call counts against the per-game ElevenLabs cap (default 50/game), and there are far more lobby line variants than that — the cap is exhausted before the game even starts, so every later persona line server-side returns `{ skipped: true }`.

Changes:

1. In `src/routes/host.tsx`, drop the `prewarmElfLines(getPrewarmLobbyLines(...))` block from the new lobby-voice init effect. Keep the rest of that effect (persona cache map + `setActiveRoomId`) — that part is what makes lobby quips actually use the pre-baked URL cache and properly room-scope live TTS.

2. In `src/lib/lobby-banter.ts`, remove the now-unused `getPrewarmLobbyLines` helper to avoid future misuse.

No other behavior changes. Lobby quips will still play (they use the same pre-baked URL cache HostGameStage loads), and the in-game announcer will be back because the per-game cap is no longer pre-burned.

## Technical notes

- Root cause: `prewarmElfLines` → `fetchAudio` → `speakPersonaLine({ roomId })`. The server-side handler increments `rooms.tts_calls_count` per call and returns `{ skipped: true, reason: "cap" }` once `count >= TTS_CAP_PER_GAME` (default 50). Prewarming ~60 spoken variants pushes the room past the cap immediately.
- A "safe prewarm" path (call without `roomId` or with a `prewarm: true` flag the server treats as cache-only) would be a larger change. Since pre-baked persona URLs already cover most lines for free, simply removing the prewarm is the smaller correct fix.