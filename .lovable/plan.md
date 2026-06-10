## Plan

1. **Initialize the Elf voice for the QR-code lobby**
   - Move the room-scoped voice setup that currently only runs inside the in-game stage into the host page lobby as well.
   - Load the pre-baked persona cache on `/host` as soon as a room exists.
   - Set the active room id while the QR-code lobby is mounted so live TTS calls are room-scoped instead of untracked.

2. **Make lobby quips wait for real voice availability**
   - Keep the existing no-backlog guard, but ensure lobby quips use the shared voice queue correctly.
   - Avoid queueing a new lobby line while a welcome intro, opener, join callout, or previous quip is still playing.
   - Keep skipped ticks as skips, not delayed backlog.

3. **Prewarm the actual lobby lines**
   - Export a helper from `lobby-banter` to list the lobby opener/idle lines with token-safe sample variants.
   - Prewarm those lines after the room code exists, so the 10-second cadence is less likely to stall on first-time TTS generation.

4. **Add temporary, low-noise diagnostics only if needed**
   - Add gated debug logs behind a local/session flag like `btd:voice-debug=1`, not always-on production logs.
   - Logs would show `lobby-quip tick`, `skipped: busy`, `queued`, and `finished`, making cadence verifiable without relying on headless audio.

## Technical notes

- The likely issue is that `HostGameStage` initializes `initPersonaCache()` and `setActiveRoomId(room.id)`, but that component is not mounted on the QR-code lobby screen. Lobby quips therefore fall back to live generation without a room id, and failures are swallowed silently.
- The fix should stay limited to `src/routes/host.tsx`, `src/lib/lobby-banter.ts`, and possibly `src/lib/elf-voice.ts` for a non-invasive busy-state helper or debug hook.