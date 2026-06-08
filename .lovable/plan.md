# Fix Round & Question Announcements

You're right — I was treating each of the 21 questions as its own "round." The game is actually **4 rounds × 5 questions + final**, where the 5th question of each round is the wildcard (lightning / double-or-nothing / etc.). I'll rewrite the announcer logic to match that mental model and pre-bake the new lines so it stays free.

## Structure (already in code, just naming it correctly)

```text
Round 1: Q1  Q2  Q3  Q4  Q5(wildcard)
Round 2: Q6  Q7  Q8  Q9  Q10(wildcard)
Round 3: Q11 Q12 Q13 Q14 Q15(wildcard)
Round 4: Q16 Q17 Q18 Q19 Q20(wildcard)
Final:   Q21
```

Derive in HostGameStage from `state.round_number` (the absolute question index):
- `roundIdx = Math.ceil(q / 5)` (1–4)
- `qInRound = ((q - 1) % 5) + 1` (1–5)
- `isWildcardSlot = qInRound === 5 && q < 21`
- `isRoundOpener = qInRound === 1`

## What the host says

Replace the current `baseText`/`NEXT_Q_LINES` block in `src/components/host/HostGameStage.tsx` (lines ~538–568) with a picker that chooses from variant pools so it doesn't sound robotic:

**Round opener (Q1 of each round)** — pick one:
- Q1 of Round 1: "Round 1. Question 1. Here we go." / "Game on. Round 1, question 1." / "Round one. First question. Don't choke."
- Q1 of Rounds 2–4: "Round N. Question 1." / "Round N kicks off. Question 1." / "New round. Question 1. Stay sharp."

**Mid-round (Q2–Q4)** — rotate through variants, seeded by `q` so it's deterministic per game but feels mixed:
- "Question N."
- "Question N coming in."
- "Onto question N."
- "Next up — question N."
- "Question N. Lock in."
- "Here's question N."
- "Question N. Eyes up."

**Wildcard slot (Q5 of rounds 1–4)** — the existing `WILDCARD_CALLOUT` lines, prefixed with a question marker so players know it's still part of the round:
- "Question 5 — and it's a wildcard. <Lightning round! Eight seconds, double points!>"
- Variants: "Final question of the round, and it's a wildcard. …" / "Round N's wildcard. Question 5. …"

**Final (Q21)** — leave the existing `final_intro` / `final_hype` path alone.

The wildcard's *explanation* (the "Eight seconds, double points!" tail) stays in `WILDCARD_CALLOUT` so it always plays with the wildcard call.

## Pre-baking (free TTS hits)

In `src/lib/announcer.functions.ts`, rewrite `ROUND_CALLOUTS` to bake exactly the lines the new picker uses:

- All round-opener variants for rounds 1–4 (≈12 lines)
- All mid-round variants with N=2,3,4 (≈21 lines)
- All wildcard-slot prefixes × 7 wildcard types (≈21 lines; full sentence baked so it's one URL hit per combo)

That's ~55 baked strings instead of the current 60 "Round 1!…Round 30!" lines, and every one of them will actually get played. The existing `generatePersonaPack` already iterates `ROUND_CALLOUTS`, so nothing else changes — re-running "Bake missing" on `/admin-tts` picks them up.

## Files touched

- `src/components/host/HostGameStage.tsx` — replace the `baseText`/`NEXT_Q_LINES`/`WILDCARD_CALLOUT` block (~538–568) with the new picker that derives `roundIdx` / `qInRound` and pulls from variant pools (with a tiny deterministic shuffle keyed off `q`).
- `src/lib/announcer.functions.ts` — replace `ROUND_CALLOUTS` (~740–746) with the new line set so the bake covers exactly what's spoken.

## Out of scope

- Persona pack lines (catchphrases, recaps) — untouched
- Game logic / scoring / wildcard rotation — untouched
- DYK explanation TTS — untouched
- Final-round intro — keeps existing `final_hype` path

After this lands, you'll head to `/admin-tts` and click "Bake missing" on the persona pack one more time to capture the new ~55 lines (~3k chars, negligible).
