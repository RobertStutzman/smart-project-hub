## Issue #5 — "Next round" vs "Next question"

**What's happening:** The current copy uses "Next round" / "Round N incoming…" / `RoundRecapReel` only when the leaderboard phase fires (every 5th question via `QUESTIONS_PER_ROUND` in `HostGameStage.tsx`). Between Q1–Q4 of a round, the reveal auto-advances straight to the next question with **no copy at all** on the player phone — so when the leaderboard *does* hit on Q5, "Next round incoming…" is the only "next" copy the user has seen and it reads as if it shows after every question.

There is also one persona line in `all_wrong` ("Round one to the question.") that fires between any question reveal and muddies the round/question distinction.

## Fix

### `src/routes/play.tsx` — add a "Next question incoming…" hint during reveal
Inside the reveal block (around lines 717–754, after the correct/wrong score chip and before the explanation card), add a small centered label:

```
Next question incoming…
```

Styled like the existing "Next round incoming…" label (muted, uppercase, `animate-pulse`). Shows only during `room.phase === "reveal"`. The leaderboard view at line 770 keeps "Next round incoming…" unchanged — it's already correct (only fires at round end).

### `src/lib/host-persona.ts` — remove the misleading line
Delete `"Round one to the question."` from the `all_wrong` array (line 191). It's the only between-question reveal line that uses round wording.

### No changes
- `RoundRecapReel.tsx` already says "Round N · Up next / To the board" — correct, fires only at round end.
- `HostGameStage.tsx` leaderboard footer "Round N+1 incoming…" — correct.
- `useRevealAutoAdvance` logic is unchanged.

## Result

Between questions: phone shows "Next question incoming…" during reveal, then jumps to the next question. At round end (every 5 questions): the recap reel plays, leaderboard shows "Round N+1 incoming…", and phone shows "Next round incoming…". The two states are now visually and verbally distinct.