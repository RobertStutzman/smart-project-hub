# Fix the question "beep" — accelerating heartbeat, stops at reveal

## Problem
During questions, `startMusic("tense", 380)` runs a square-wave synth loop that fires a tone every 380ms. It also keeps playing through the `reveal` / `final_reveal` phases, so it feels nonstop and annoying.

## Changes

### 1. Stop the bed at lock-in / reveal
`src/components/host/HostGameStage.tsx` (the phase → music effect, ~line 613):
- Only start "tense" during `question` and `final_question`.
- On `reveal` / `final_reveal`, call `stopMusic()` (the reveal already has its own SFX — drop sound, correct sting, etc., it doesn't need a bed).

### 2. New "tense" sound = accelerating heartbeat
`src/lib/sound-engine.ts`, replacing the square-wave loop inside `startMusic("tense", …)`:
- Use WebAudio (no new assets) to synthesize a two-thump heartbeat: a low sub-bass kick (~55 Hz sine, fast pitch drop, short envelope) followed ~140ms later by a softer second thump. That's one beat.
- Schedule beats on a self-rescheduling `setTimeout` (not `setInterval`) so we can vary the interval per beat.
- Interval ramps from ~900ms at start down to ~300ms over the question window. Since the engine doesn't know the question duration, expose an optional `startHeartbeat(opts?: { fromMs?: number; toMs?: number; rampMs?: number })` and call it from HostGameStage with the current question's `secondsLeft * 1000`. Default ramp = 12s if no opts.
- Keep `startMusic("tense")` as the public entry point — internally it now delegates to the heartbeat. Lobby mode is untouched.
- Volume stays low (~0.06) and respects `duckActive` and `muted`, same as today.
- `stopMusic()` already calls `stopLoopAudio()` which clears `synthLoopTimer`; reuse that same timer slot for the heartbeat so stop logic is unchanged.

### 3. Wire question duration into the heartbeat
`src/components/host/HostGameStage.tsx`:
- Where it currently calls `startMusic("tense", 380)` for `question`/`final_question`, pass the remaining seconds so the ramp matches: e.g. read `state.question_ends_at` / current `secondsLeft` already available in the stage, and call `startMusic("tense")` plus a follow-up `setHeartbeatRamp(secondsLeft * 1000)` — or simpler: extend `startMusic` to accept `{ rampMs }` for tense mode.

## Out of scope
- Lobby music (unchanged).
- Final wager bed (unchanged — uses uploaded `final_wager_bed.mp3`).
- Per-second `tick` / `tickHeavy` SFX fired by the timer (those are separate and already stop with the timer).
- No new audio assets.

## Verification
- Enter a question → low double-thump heartbeat, slow at first, accelerates as the timer runs.
- Timer ends or first player locks in → reveal fires → heartbeat stops immediately.
- Mute toggle silences it; unmute restarts cleanly.
- Lobby music unaffected.
