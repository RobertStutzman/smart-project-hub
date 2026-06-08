# Fix the intro flow + audio

Three problems, three fixes — all in the boot sequence.

## 1. Remove the redundant "Press OK to start" screen

Current flow:
```
Tap to begin (gate)  →  Splash  →  Credits  →  Tips (how to play)  →  Press OK to start (ready)  →  Landing (host / join)
```

The `ready` stage is doing the same job as both the gate before it and the landing page right after it. Cut it.

New flow:
```
Tap to begin (gate)  →  Splash  →  Credits  →  Tips (how to play)  →  Landing (host / join)
```

Changes in `src/components/BootSequence.tsx`:
- Drop the `"ready"` stage from the `Stage` union, timers, dots, and the `ReadyStage` component.
- After `tips` finishes (visual baseline AND VO both done), call `complete()` directly so the boot overlay fades out and the user lands on the host/join screen.
- Keep "press any key to skip" working — skipping from `tips` jumps straight to `complete()`.
- Progress dots become 3 (splash / credits / tips).

## 2. Restore the crowd audio

Right now the landing page only starts `startLobbyChatter` (target gain 0.11 — barely audible chatter bed). The louder `startCrowd` layer (target 0.18) never plays until you reach `/host`.

Change: when the gate is tapped (and on standalone launch), start BOTH `startLobbyChatter()` and `startCrowd()` so you actually hear a room of people from the moment the intro begins, and that bed continues onto the landing page. Also call `startCrowd()` from `useLobbyChatter` so a user who skips the boot (sessionStorage flag set) still gets the crowd.

## 3. Make the announcer audible during the Tips/How-to-play stage

The `TIPS_VO` line plays via `speakAsElf(..., { preset: "hype" })` with default volume `1.0`, but the crowd + chatter beds (combined ~0.29 gain) are loud enough to bury it.

Two-part fix in `src/lib/ambience-engine.ts` + `BootSequence.tsx`:
- Add a `duckAmbience(targetMultiplier, ms)` / `unduckAmbience(ms)` pair that ramps the active loop gains down to ~35% of their target while the announcer is talking, then back up.
- In the `tips` effect, call `duckAmbience(0.35, 400)` before `speakAsElf(TIPS_VO, ...)` and `unduckAmbience(500)` in the `.then()` after VO finishes (and on cleanup).
- Also bump `speakAsElf` call to `{ volume: 1.0 }` explicitly and verify the line is being fetched (no skipped/blocked response) — the prewarm already runs on the gate tap, so by the time tips render the audio should be cached.

## Technical notes

- `Stage` type, `STAGE_DURATIONS`, the dots array, the splash-sound effect's `ready` branch, and the auto-advance-off-ready effect all need to be cleaned up together — partial removal will leave dangling references and break the build.
- The duck/unduck helpers operate on the existing `chatter` / `crowd` / `drumroll` LoopLayer `gain` nodes using the same `rampGain` utility already in the file. No new audio buffers needed.
- Nothing in this plan touches `/host`, `/join`, the question stage, or the announcer server function — only the boot overlay and the ambience engine's gain API.

## Out of scope

- Changing the actual VO line, voice, or persona.
- The TWA / Play Store packaging (still paused per your earlier instruction).
- Replacing the crowd-ambience source file.
