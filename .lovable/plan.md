# Fix #1 — Phantom Round 5 (one extra question before Final)

## Problem
The game is meant to be 4 rounds × 5 questions = 20 questions, then 1 final question. Instead, after Round 4 finishes (question 20), a single extra question plays (question 21) before the final intro fires. That's the "Round 5 with one question" you saw.

## Root cause
In `src/components/host/HostGameStage.tsx`:

```ts
const FINAL_ROUND_NUMBER = 21;
```

This constant gates two transitions:

1. **Leaderboard auto-advance** (line ~640): after the round-end leaderboard, if `completedQuestionNumber >= FINAL_ROUND_NUMBER` it calls `startFinalRound`, otherwise it calls `nextQuestion`. With the threshold at 21, completing q20 → calls `nextQuestion` → q21 plays. Only after q21 does it transition to final.
2. **`useRevealAutoAdvance`** (line ~1557): treats `roundNumber >= FINAL_ROUND_NUMBER` (i.e. only q21+) as the final question's reveal, with the regular `roundNumber % 5 === 0` branch covering end-of-round leaderboards.

## Fix
Change the constant to `20` so completing q20 jumps straight to `startFinalRound`. The display math (`getCompletedRoundNumber = floor(q/5)`, RoundSplash `min(4, ceil(q/5))`) is already correct for a 20-question + final layout, so no other edits needed.

```ts
const FINAL_ROUND_NUMBER = 20;
```

The `useRevealAutoAdvance` end-of-round condition `(roundNumber % 5 === 0 || roundNumber >= 20)` still works — q20 satisfies both branches and shows the leaderboard once before the final transition.

## File
- `src/components/host/HostGameStage.tsx` — one-line change at line 1537.

## Verification
Run a dry-run game through Round 4. After question 20's reveal + leaderboard, the next screen should be `final_intro` (announcer: "final hype"), not another question.

After this lands we'll move on to #2 (the cut-off "Did you know?" before winner screen).
