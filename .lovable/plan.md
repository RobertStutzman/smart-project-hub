## Problem
Announcer is saying "Round 2. Question 1." because `getRoundCallout` uses `qInRound = ((q-1) % 5) + 1` for the spoken number. The user wants absolute numbering 1–20 across the whole game, with round mentioned only at openers. (Q21 = final, handled separately.)

## Fix
Rewrite the pools in `src/lib/round-callouts.ts` so every spoken number is the absolute `q` (1..20). Round wording stays only on round-openers.

### New copy

**Round openers (Q1, 6, 11, 16):**
- Q1 (round 1): keep current `ROUND1_OPENERS` ("Round 1. Question 1. Here we go." etc.) — already absolute.
- Q6/11/16: `Round {n} begins. Question {q}.` / `Round {n} kicks off. Question {q}.` / `New round. Question {q}. Stay sharp.`

**Mid-round (Q2–4, 7–9, 12–14, 17–19):** `Question {q}.` / `Question {q} coming in.` / `Onto question {q}.` / `Next up — question {q}.` / `Question {q}. Lock in.` / `Here's question {q}.` / `Question {q}. Eyes up.`

**Wildcards (Q5, 10, 15, 20):** prefix becomes `Question {q} — and it's a wildcard.` / `Final question of the round, and it's a wildcard.` / `Wildcard time. Question {q}.` Wildcard tail (`WILDCARD_TAIL`) unchanged.

### Implementation
- Change `roundNOpeners(n)` → `roundNOpeners(n, q)` returning the three opener lines with `q` interpolated.
- Change `midRoundLines(n)` → `midRoundLines(q)` (already takes a number — just feed absolute `q` instead of `qInRound`).
- Change `wildcardLines(kind, q)` to interpolate `q` into the prefixes.
- In `getRoundCallout`, drop the `qInRound` derivation for the *spoken* number — pass `q` everywhere. Still use `qInRound === 1/5` to pick the **pool**, and `roundIdx` to label the opener.
- Update `ALL_ROUND_CALLOUTS` to enumerate every concrete string the new functions can produce:
  - Round-1 openers (q=1) — 3 lines
  - Round-2/3/4 openers (q=6, 11, 16) — 3 lines × 3 rounds = 9
  - Mid-round lines for q ∈ {2,3,4,7,8,9,12,13,14,17,18,19} — 7 × 12 = 84
  - Wildcard lines for q ∈ {5,10,15,20} × 7 kinds × 3 prefixes = 84
  - Total: 180 strings (up from current ~50). Persona-pack baker will TTS-bake each on next bake run; existing baked clips for the old strings become unused but stay in the cache (no breakage).

### Knock-on
- `generatePersonaPack` re-bakes from `ALL_ROUND_CALLOUTS` and is keyed by content hash — new strings get baked, old ones stay cached but unreferenced. User will need to re-run "Bake persona pack" once for the new lines to be available; before then the runtime fallback (live TTS) will speak them.
- No other call site references the old per-round-q copy. `getRoundCallout`'s signature is unchanged.

## Verify
- `bun run build` clean.
- Spot-check `getRoundCallout({ questionNumber: 6, wildcard: null })` returns a string containing "Round 2" and "Question 6".
- `getRoundCallout({ questionNumber: 7, wildcard: null })` returns "Question 7" (no round wording).
- `getRoundCallout({ questionNumber: 10, wildcard: "lightning" })` returns a string containing "Question 10" and the lightning tail.
