# Round 1 audio fix: band bed plays cleanly through intro

## Root cause recap

On the first transition out of `lobby` (i.e. start of round 1), `HostGameStage`'s music effect:
1. Calls `climaxAndHandoff()` — fires a ~700–900 ms **cymbal swell** and fades crowd ambience.
2. Immediately falls through to `startMusic("lobby", 600)`.

The band bed starts under the cymbal, so it's masked. By the time the cymbal clears, the `intro` splash is often already advancing toward `question`, and `startMusic("tense")` calls `stopLoopAudio()` / `stopOtherMusic("loop")` which kills the bed before you hear it.

Rounds 2/3 don't have this problem because they're preceded by `leaderboard` (no cymbal, several seconds of clean bed).

## Changes

### 1. Delay the round-1 band bed until after the cymbal swell — `src/components/host/HostGameStage.tsx` (music effect, ~lines 571–632)

Add a one-shot ref `firstIntroBedScheduledRef = useRef(false)` next to `ambienceHandedRef`.

In the "first transition out of lobby" branch (where `climaxAndHandoff()` is called):
- After invoking `climaxAndHandoff()`, if `state.phase === "intro"` (or `final_intro`), schedule `startMusic("lobby", 600)` via `window.setTimeout(..., 850)` instead of letting the fall-through fire it immediately. Mark `firstIntroBedScheduledRef.current = true`.
- Inside the timeout, before calling `startMusic`, re-check that `currentPhaseRef.current` (a small ref that mirrors the latest `state.phase`) is still `intro` / `final_intro` / `lobby` / `leaderboard` — if the phase has already moved to `question`, skip the late start so we don't bring music back during a question.
- After scheduling, `return` from the effect so the if/else chain doesn't ALSO fire `startMusic("lobby")` synchronously and double-trigger.

Add `currentPhaseRef = useRef<string | null>(null)` and update it at the top of the effect: `currentPhaseRef.current = state.phase`.

Clear/cancel the timeout in the effect's cleanup so a rapid phase change doesn't leave a stale `startMusic` call queued.

### 2. Don't let `startMusic("tense")` yank the bed without a short fade — `src/lib/sound-engine.ts` (`stopLoopAudio`, ~line 499)

Currently `stopLoopAudio()` does `loopAudio.pause(); loopAudio.currentTime = 0;` — instantaneous, hard cut.

Add a small fade-out when there's a live `loopAudio`:
- Ramp `loopAudio.volume` from current → 0 over ~180 ms via a `setInterval` (8 steps), then `pause()` + null the reference.
- Keep the synchronous teardown for `synthLoopTimer` (no audio artifact there).
- Expose an optional `immediate` flag (`stopLoopAudio(immediate = false)`) so `setMuted(true)` and `silenceAllAudio` still cut instantly.

This means if `intro → question` does happen mid-bed, the bed fades out under the first heartbeat instead of clicking off.

### 3. Wire the optional bed extension into `intro` only (no behavior change for `question`/`reveal`)

No new flag for the user — `intro` already calls `startMusic("lobby")`. The change above makes that call happen *after* the cymbal swell, so the bed has clean air to play.

## Out of scope

- The heartbeat synth itself (sub-bass audibility) — that's the separate "do we like the heartbeat" question and not part of this fix.
- The leaderboard/lobby music wiring for rounds 2/3 — already works.
- Final-round intro (`final_intro`) — covered automatically by the same `intro`-style scheduling check.
- Ambience `crowd`/`chatter` layers — untouched.

## Verification

- Fresh game, click Start on the QR lobby:
  - Cymbal swell plays cleanly.
  - ~850 ms later, the band bed comes in audibly under the "Get Ready / Question 1" splash. **Not masked.**
  - When phase flips to `question`, the bed fades out over ~180 ms instead of clicking off, and the heartbeat starts.
- Round 2 and round 3:
  - Leaderboard → band bed (unchanged, still clean).
  - Intro → bed continues (already playing, no double-trigger).
  - Question → fade-out + heartbeat.
- Mute toggle still cuts instantly (uses `immediate` flag path).
- Final round intro behaves like a normal intro.
