
# 20s round with a 5s read window + calm "eliminated" mark

Two unrelated changes.

## 1. 20-second question with a 5-second reading window

Today: 15s total, answers tappable immediately, speed bonus rewards being first.

Goal: 20s wall time, the first **5s is read-only** (no answer locks possible), then **15s to answer**. Scoring is unchanged (15s answer window stays the speed-bonus baseline, so nobody is silently penalized for late-launching).

### How

Server (`src/lib/game.functions.ts`, `startNextRound` only — not the final round, which already has its own 25s feel):
- Set `question_duration_ms = 15000` (unchanged — the answering window) but set `question_started_at = now() + 5000` (5s in the future). The existing scoring formula keys off `question_started_at`, so the timer ring naturally counts 15s from when answers unlock.
- Server-side `lockAnswer` already rejects late locks; we also reject locks made *before* `question_started_at` (defensive — clock skew makes this rare but worth blocking).

Host TV (`src/components/host/QuestionStage.tsx`):
- While `Date.now() < question_started_at`, show a big centered "Get ready… N" countdown overlay (5 → 1) on top of the answer grid; answer cards render but appear dimmed and non-interactive.
- When the count hits 0, the overlay fades, cards pop to full brightness, and the existing TimerRing starts counting down from 15s. This already happens automatically once `question_started_at` arrives.

Player (`src/routes/play.tsx`):
- `AnswerGrid` gets `disabled` when `Date.now() < question_started_at`, with the same "Get ready… N" message above the grid. After 0, buttons unlock.

Timer ring math: pass `max=15` (the answer window) so the visible countdown is 15 → 0 once answers unlock. The 5s read phase has its own separate countdown UI; the ring stays hidden until answers unlock.

### Tradeoffs / what won't change

- "Time to first lock" stops including reading time, so the leaderboard reflects actual recall speed rather than reading speed. Net positive for fairness.
- Final-round timing is untouched.
- No DB schema change.

## 2. Eliminated answer: one shatter, then a calm static X

Today on the host TV, when an answer is eliminated, a 6-shard shatter explodes + a big ✕ stamps and **both fade away**, leaving the card just dimmed/grayscale. The dramatic effect plays cleanly once, but there's no lingering visual indicator that the answer was eliminated — and re-renders during reveal can occasionally re-trigger the entrance animation, making it feel like it "keeps happening".

Goal: keep the punchy shatter (it's good!) but have it land on a **persistent, calm static ✕** so the answer stays visibly eliminated for the rest of the question without further animation.

### How

In `src/components/host/QuestionStage.tsx` (`ShatterOverlay` + the wrapping `AnimatePresence`):
- Keep the shards-fly-out animation, but **don't fade the ✕ to 0**. Animate it from `scale 1.4 → 1, opacity 1 → 0.85` over 0.5s and leave it there. The shards still fly off and disappear after 0.7s.
- Wrap the whole overlay in a stable keyed div (not AnimatePresence-exit-driven) so it can't re-mount mid-question. Use the question id + index as the key so it only animates once per question per slot.
- Remove the bottom "✕ · LABEL" caption — redundant with the grayed card.

Player side (`AnswerGrid.tsx`) already shows a static ✕, so no change there.

### If I guessed wrong on the X

If you actually meant "the player-side static ✕ is too big and keeps redrawing" — say the word and I'll just shrink/tone that one instead.

## Files

- `src/lib/game.functions.ts` — `startNextRound`: offset `question_started_at` by +5000ms; `lockAnswer`: reject pre-start locks.
- `src/components/host/QuestionStage.tsx` — read-window overlay + countdown; persistent static ✕ in `ShatterOverlay`.
- `src/routes/play.tsx` — read-window overlay; disable `AnswerGrid` until start.
