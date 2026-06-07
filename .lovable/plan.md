## Goal

Move from 3 rounds × 5 + final (15 Qs) to **4 rounds × 5 + final (21 Qs)** — pub-trivia length, ~15–18 min per game.

## Changes

**1. `src/components/host/HostGameStage.tsx`**
- `FINAL_ROUND_NUMBER`: `15` → `21`
- `QUESTIONS_PER_ROUND` stays `5` (so leaderboard fires after Q5, Q10, Q15, Q20, then final at Q21)

**2. `src/lib/game.functions.ts` — `wildcardForRound()`**
Spread one wildcard per regular round (mid-round, so it doesn't collide with the end-of-round leaderboard beat):
- Round 1 → Q3: `saboteur`
- Round 2 → Q8: `lightning`
- Round 3 → Q13: `glitch`
- Round 4 → Q18: `roast`
- Final (Q21) — no wildcard (already has wager mechanic)

**3. Copy updates**
- `src/components/HowToPlay.tsx`: update any "3 rounds" / question-count language
- `src/components/BootSequence.tsx`: same check
- No DB schema changes — `round_number` is just an int counter, no enum/constraint

## Out of scope
- Per-round themes (Music / Sports / etc.) — flagged earlier as nice-to-have, would need a category field on questions + a round-theme picker. Ask separately if you want it.
- Wager mechanic for the final — already exists (`startFinalRound` / `scoreFinalRound`).

## Risk
Low. Active in-flight games on the old length will still finish (logic is `>=` based, not hardcoded round-by-round). New games start using 21.