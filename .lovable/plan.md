## Two changes

### 1. Live points countdown
**Today:** points are awarded at reveal as `round((remainingTime / totalTime) * 1000)` (capped at 1000, +10% if streak ≥ 3, ×2 if pending 2x, +25% rubber-band — none of which players see). So if you lock at 0 s remaining, you get 0. At full time, 1000. Nobody currently sees the meter ticking down.

**Add:** a live "Lock now: **873**" ticker on both host and player screens, visible only during `phase === "question"`.

- Math (client-side, no DB change): `Math.max(0, Math.round((remainingS / totalS) * 1000))`. Recomputed every 100 ms using the same `now` clock both surfaces already poll.
- Host (`QuestionStage.tsx`): drop it next to the existing seconds-remaining display in the top status bar — big, monospaced, color-shifts amber → rose as it drops below 400, then 150.
- Player (`play.tsx`): smaller chip above the answer grid. **Once the player has locked an answer, freeze the ticker on the value at lock time** (computed from `current_answer_locked_at`) so they see exactly what they're banking — instead of watching it keep ticking down on a number they already locked in.
- Bonuses (streak/2x) are intentionally hidden from this number to keep the spoiler-free "rubber-band" surprise and the existing 2x reveal moment intact. If you want 2x to multiply the ticker (so the player sees their gamble in real time), say the word.

### 2. Real-time avatars on answer tiles when players pick
**Today:** `QuestionStage.tsx` renders the per-tile avatar chips inside `phase === "reveal"` (line 214) — so during the actual question, you can't see who picked what or who switched.

**Add:** render the avatar chips on each answer tile during `phase === "question"` too. When a player changes their pick, their avatar disappears from the old tile and appears on the new tile (driven by Realtime updates to `players.current_answer`, which both host and player already subscribe to).

- Visual treatment during `question` phase: just the avatar circle (no nickname pill, no color — that would spoil right vs. wrong). Slight `motion.div` fade-in / fade-out using the existing `framer-motion` import, keyed by player id, so the swap reads as "Sam slid over."
- At `phase === "reveal"`, the existing nickname-pill chips take over (correct = amber, wrong = rose). No change to that.
- Player screen (`play.tsx` answer grid): same treatment — show other players' avatars on each tile in real time so kids see "everyone else moved to B" social pressure. (If you want this host-only and keep the player screen clean, say so.)
- Show up to 8 avatars per tile during the question (smaller than the reveal chips), then "+N" overflow.

## Out of scope
- Surfacing 2x / streak / rubber-band in the live points number (keeps surprises).
- Animating the score-bank itself at reveal — separate ask if you want it.

## Files touched
- `src/components/host/QuestionStage.tsx` — add points ticker, move avatar chips out of the reveal-only branch and add a question-phase variant.
- `src/routes/play.tsx` — add points ticker (freezes on lock) + avatar overlays on the answer grid.
- No DB / server changes. No new dependencies.
