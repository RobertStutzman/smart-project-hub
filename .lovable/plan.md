## Goal

Stop the redundant "scan the QR / grab your phone" sequence after the host starts the game, and make sure no idle lobby voice lines can leak into the intro or first question.

## Changes

### 1. Skip the "How to Play" overlay after start

`src/components/HowToPlay.tsx` is the 3-slide overlay that triggers right after the host clicks Start. Its first slide ("Grab your phone…") narrates the join instructions a second time even though every player is already in the lobby.

- In `src/routes/host.tsx` `handleStartClick`, always call `actuallyStart()` directly. Drop the `HOWTO_KEY` sessionStorage check and the `setShowHowTo(true)` branch so the overlay never appears between lobby and IntroStage.
- Remove the now-unused `showHowTo` state, the `<HowToPlay>` render, the `HOWTO_KEY` constant, and the `HowToPlay` import from `src/routes/host.tsx`.
- Leave `src/components/HowToPlay.tsx` itself in place (still referenced from the landing page / docs) — just unhook it from the host start flow.

### 2. Hard-stop lobby audio the moment the game starts

The lobby quip effect cancels its own timers on phase change, but a quip that was already queued in the shared Elf voice FIFO will keep playing into the IntroStage. The join-callout queue (`joinQueueRef` / `joinDrainingRef`) has the same problem.

In `src/routes/host.tsx` `actuallyStart()`, before calling `restartGameFn` / `setPhaseFn`:

- Dynamically import `@/lib/elf-voice` and call `cancelElfSpeech()` to drain anything already speaking or queued (welcome, opener, quip, join callouts).
- Stop the lobby music bed via `stopMusic()` from `@/lib/sound-engine` so the handoff into IntroStage is clean (IntroStage's own `whoosh` + ambience handoff takes over).
- Clear the pending join-callout queue (`joinQueueRef.current = []`) so a name that arrived in the final second can't fire after the intro starts.
- Reset the per-room welcome guard (`window.__btdWelcomedRooms?.delete(room.id)`) so a future Play Again lobby still gets its welcome, but the current lobby's welcome can't replay.

### 3. Verify intro path is unchanged

`IntroStage` (`src/components/host/IntroStage.tsx`) already owns the post-lobby flow: whoosh → intro hype line → roster → "here we go in three" countdown → GO. No changes there; it becomes the single intro the player sees once the lobby ends.

## Technical notes

- `actuallyStart` becomes `async` work that awaits the cancel + stop calls before the phase write, so there's no race where the new `intro` phase mounts `HostGameStage` while a stale quip is still in the speaker.
- `cancelElfSpeech()` already drains both the in-flight ElevenLabs request and any queued items, which is exactly what we need for items 1 and 2 of the bug report.
- Removing `HowToPlay` from the host route doesn't affect players (`/play`) — they never saw it.
