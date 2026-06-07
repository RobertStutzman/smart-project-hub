## Two bugs

After the first 5 questions, the recap reel shows "Recap · Round 5" and then freezes. Causes:

**1. Recap label is mislabeled.** `state.round_number` increments per *question* (1..15), not per *round*. The leaderboard fires at the end of every 5 questions (`QUESTIONS_PER_ROUND = 5` in `HostGameStage.tsx:923`), so the end of the first 5-question round legitimately shows `round_number = 5`. The recap displays that value verbatim → "Round 5" instead of "Round 1".

**2. Recap never completes (frozen).** In `RoundRecapReel.tsx:49-57`, the timer effect depends on `[triggerKey, onDone]`. The parent (`HostGameStage.tsx:804`) passes `onDone={() => setRecapDoneForRound(state.round_number ?? 0)}` — a new function identity on every render. Realtime subscriptions (players, room) fire frequent re-renders → the effect re-runs → all timers (including `onDone`) are cleared and restarted from beat 0. With even modest activity the reel can never finish. After the first 5-question round we also have lots of score/streak updates landing right around this time, so the freeze is consistent.

Symptom matches exactly: beat 0 renders ("Recap · Round 5"), beats 1/2 never appear, `onDone` never fires, leaderboard never shows.

## Fix

Both fixes are frontend-only.

**A. `src/components/host/RoundRecapReel.tsx`**
- Stabilize the timer: stash `onDone` in a ref and depend only on `[triggerKey]` in the effect. This prevents re-render churn from resetting beats.

**B. `src/components/host/HostGameStage.tsx`**
- Compute a display round number `recapRoundDisplay = Math.ceil((state.round_number ?? 0) / QUESTIONS_PER_ROUND)` and pass that as `roundNumber` to `<RoundRecapReel>`. Keep `triggerKey` as `state.round_number` so it still re-fires per leaderboard milestone.
- Also fix the standings header just below (line 826) to use the same computed value so it reads "Round 1 — Standings" instead of "Round 5 — Standings". Preserve the "— Final" suffix logic (still keyed off `isFinal` which uses raw `round_number >= 15`).

## Out of scope

Not touching: question-picker logic, leaderboard auto-advance behavior (host still clicks "Next question →"), or the `QUESTIONS_PER_ROUND` value itself.