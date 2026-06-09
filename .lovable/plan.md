## Restart bug: stale `round_number` when starting from QR lobby

### Root cause (confirmed against the DB)
Recent room `LFRD` has `phase='lobby'`, `status='ended'`, `round_number=22`, `current_category='Movie Sci-Fi'`. The host's QR-code lobby (`src/routes/host.tsx`, `actuallyStart`) calls only `setPhase({ phase: "intro" })` — it never calls `restartGame`. Only the in-stage `CreditsStage` → "Play again" path calls `restartGame`.

So whenever a user returns to lobby through any other path (a previous ended game where they didn't click "Roll credits → Play again", a refresh, switching tabs, the "New room" recreate that still leaves stale row data lingering, etc.) and then clicks Start on the QR lobby:

1. `setPhase("intro")` runs — `round_number` stays at 22.
2. Intro → `nextQuestion` → `nextRound = 22 + 1 = 23`.
3. On reveal, the leaderboard auto-advance (`HostGameStage.tsx` line 617) sees `completedQuestionNumber (23) >= FINAL_ROUND_NUMBER (21)` and fires `startFinalRound`.

Result: 1 question then straight to final round, exactly as reported.

### Fix
Make the QR-lobby Start button always run a clean reset before starting.

**`src/routes/host.tsx`**
- Import `restartGame` alongside the existing server fn imports.
- Add `const restartGameFn = useServerFn(restartGame);` near the other hook calls.
- In `actuallyStart()`, await `restartGameFn({ data: { roomCode, hostSessionId } })` first, then call `setPhaseFn({ phase: "intro" })`. Wrap both in the existing try/catch so a reset failure surfaces via `setError`.

`restartGame` is idempotent — running it on a fresh lobby (round 0, no players' scores) is a no-op-shaped update — so this is safe even for first-game starts.

### Out of scope
- No changes to `HostGameStage` or `restartGame` server fn.
- No changes to the in-stage Play Again flow (already works).
- No changes to the new intro countdown or click sfx.
