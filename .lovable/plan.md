# Fix: "Round N" announcement matches question number

## Problem
`state.round_number` is actually the **global question index (1–21)**, not the round. So on Q2 the host voice says "Round 2", on Q3 "Round 3", etc. The on-screen splash also pops up every question saying "Round 2", "Round 3"…

It should be **4 rounds × 5 questions** → round = `ceil(question / 5)`, capped at 4. Q21 is the final (its own phase, separate splash).

## Changes

### 1. `src/components/host/HostGameStage.tsx` — round intro voice (~lines 308–338)
- Rename local `r` → `q` (it's the question index, not round).
- Compute `displayRound = Math.min(4, Math.ceil(q / 5))`.
- Only announce **"Round N!"** at the start of each round (q = 1, 6, 11, 16). Other questions get neutral hype lines ("Next!", "Here we go!", "Lock in!", "Keep going!") — no round number.
- Q1 stays as "Round 1! First question!".

### 2. `src/components/host/HostGameStage.tsx` — splash (line 613)
- Pass `round={Math.min(4, Math.ceil((state.round_number ?? 1) / 5))}` to `<RoundSplash />` instead of the raw question index.
- `RoundSplash` only fires when its `round` prop changes, so it will now show only on Q6/Q11/Q16 (Q1 suppressed by its `round > 1` guard, which is correct — Q1 already has the intro flow).

### 3. No change to `RoundSplash.tsx`, server logic, or wildcard mapping
The underlying `round_number` field in the DB stays as the question index (used everywhere for question progression). Only display + voice are corrected.

## Risk
Tiny — pure presentation fix in one file. No DB/server changes. Existing wildcard logic (Q3/8/13/18) unaffected.
