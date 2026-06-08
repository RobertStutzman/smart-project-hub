
## Goal
Single pass audit of the whole app: audio (voice + music), error handling, mobile/responsive, routing/auth, performance, and a few correctness traps in the credits/highlight flow. Then fix everything in one batch.

## What I already verified
- All 11 public tables have RLS on.
- Voice queue (`elf-voice.ts`) is single-threaded → no overlap *while* the queue runs, but pending timers and music beds leak across stage changes.
- Music ducking only covers `loopAudio`, not credits / wager beds.

## Findings to fix

### A. Audio orchestration (overlap + leak)
1. **Credits Vox stacks past unmount** — `CreditsStage` schedules ~9 `setTimeout` voice cues but cleanup only stops music; queued lines play on next screen.
   → Add `cancelElfSpeech()` to cleanup, Skip button, and Play Again button.
2. **Award roasts too tightly packed** — 4.8s spacing < real TTS length.
   → Bump to 6s, cap roasts at 4, cap highlight quips at 3.
3. **`duckMusic` doesn't duck credits / wager beds** — voice fights the band.
   → In `sound-engine.ts`, extend `duckMusic(on)` to also scale `creditsAudio` and `wagerBedAudio` (remember base volume per element).
   → Call `duckMusic(true/false)` around each `speakPersona` in `CreditsStage` and `FinalStages`.
4. **Victory sting overlaps credits music** — `playEvent("victory")` fires on `ended`, then credits music starts immediately.
   → Delay `playCreditsMusic` by 700ms inside the credits effect.
5. **Lobby chatter + lobby music both playing** — two ambient beds at once on `/host` and `/play` lobby.
   → Stop `lobbyChatter` when phase leaves `lobby`.
6. **Final stages leak** — host hotkey navigation skips voice cleanup.
   → Add `cancelElfSpeech()` to `FinalStages` cleanup.
7. **Recap reel truncates itself** — every beat uses `interrupt: true`, so "Fastest finger" cuts the opener.
   → Only the first beat interrupts; rest queue.
8. **Voice queue has no idle reset** — if a request hangs, the queue chain holds forever.
   → Wrap each task in `Promise.race` with a 12s safety timeout.

### B. Correctness
9. **`CreditsStage` shadows `ranked`** — outer `useMemo` ranked + inner `const ranked` inside effect; harmless today but confusing.
   → Use the outer `ranked` inside the effect.
10. **Console warning** `Unknown message type: RESET_BLANK_CHECK` — coming from preview harness, not our code. No action; document as ignored.

### C. Routing / auth
11. **Server fn auth wiring** — verify `attachSupabaseAuth` is in `src/start.ts`'s `functionMiddleware` (required for `requireSupabaseAuth` fns). Add if missing.
12. **`__root.tsx` Outlet present** — confirm during edit pass.

### D. UX hardening
13. **Mute should also stop credits/wager beds** — `setMuted(true)` only calls `stopMusic()`, not the new beds.
    → In `setMuted(true)`, also call `stopCreditsMusic(0)` and `stopWagerBed(0)`.
14. **Wake lock on host stage** — confirm `use-wake-lock` is attached on `/host` (prevents screen sleep mid-game). Add if missing.

## Files to change
- `src/lib/sound-engine.ts` — extend `duckMusic`, mute clears all beds.
- `src/lib/elf-voice.ts` — per-task safety timeout.
- `src/components/host/CreditsStage.tsx` — cleanup voice, delay music, duck around lines, retime roasts, use outer `ranked`, cleanup on Skip / Play Again.
- `src/components/host/FinalStages.tsx` — `cancelElfSpeech` cleanup, duck around lines.
- `src/components/host/RoundRecapReel.tsx` — only first beat interrupts.
- `src/routes/host.tsx`, `src/routes/play.tsx` — stop lobby chatter on phase change; wake lock if missing.
- `src/start.ts` — verify/append `attachSupabaseAuth` if absent.

## Explicitly out of scope
- No new audio assets, no TTS prompt rewrites.
- No DB schema changes.
- No design/visual changes beyond what's required for the fixes.

Confirm and I'll implement all of it in one pass.
