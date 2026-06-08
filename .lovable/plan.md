## Issue #5 (revised) — Announcer should say "next question" between questions

**What's happening:** In `HostGameStage.tsx` (lines 470–494) the host announces every time the room enters the `question` phase. The logic:

- q = 1, 6, 11, 16 → "Round 1! First question!" / "Round N!"
- every other question → random `question_open` line ("Lock it in.", "Eyes up.", "Round 'em up.", etc.)

Between questions inside a round, the announcer never says "next question" — and at every 5th question the user hears "Round N!" which reads as the announcer talking about rounds after every question. The round-end recap reel also speaks `round_recap` lines (many include "next round in") that overlap with the perceived pattern.

The fix: explicitly differentiate three entry points by what the previous phase was.

## Fix

### `src/components/host/HostGameStage.tsx` (lines 470–494)
Change the announce-on-question-enter block so the text depends on `prev` phase:

- **From `lobby` or empty** (game start, q=1): keep `"Round 1! First question!"`.
- **From `leaderboard`** (new round starting, q=6/11/16): keep `` `Round ${displayRound}!` ``.
- **From `reveal`** (mid-round, q within a round): pick from a new `NEXT_QUESTION_LINES` pool. Examples:
  - `"Next question."`
  - `"Onto the next question."`
  - `` `Question ${q} coming up.` ``
  - `"Here comes the next one."`
  - `"Next one. Lock in."`
  - `"Question incoming."`
  - `"Onward. Next question."`

Define `NEXT_QUESTION_LINES` as a local const in this file (or export from `host-persona.ts` as a new moment key `next_question`) and pick randomly per question (seeded by `q` for determinism, like `pickLine` does).

### `src/lib/host-persona.ts`
- Remove `"Round 'em up."` from the `question_open` array (line 90) — it's the one line in that pool that misreads as round talk.
- Leave `round_recap` and `round_transition` arrays alone — those fire only at end-of-round and their "next round" wording is correct there.

### No changes
- `RoundRecapReel.tsx`, the leaderboard view, and `useRevealAutoAdvance` are unchanged.

## Result

- Mid-round (after a reveal): announcer says "Next question." / "Onto the next question." / "Question 4 coming up."
- End of round (leaderboard → new round): announcer says "Round 2!" (etc.) once, as the new round actually starts.
- Game open (q=1): "Round 1! First question!" as today.

The announcer only mentions "round" when a round actually flips.