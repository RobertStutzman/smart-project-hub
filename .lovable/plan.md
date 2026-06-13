# Immediate wrong-answer feedback on the player's phone

## Goal
When a player taps an answer on their phone, they see right away whether it's wrong or right — they don't have to wait for the round to end. Wrong picks visibly "burn" on their tile and they can keep tapping until they land on the correct one. The TV/host screen and scoring are unchanged.

## Where it broke
`src/routes/play.tsx` already fetches `room.current_correct_index` (line 143), but the per-player `<AnswerGrid>` during the question phase (line 819) never receives a `correctIndex`, so the tile only turns green/red at `room.phase === "reveal"`. The component already supports immediate styling — we just stopped feeding it.

## Changes (frontend only, `src/routes/play.tsx`)

1. **Per-player wrong-tile memory.** Add local state `wrongPicks: Set<number>` keyed off `room.current_question_text`. Reset whenever the question text changes (and on phase leaving `"question"`).

2. **In `pick(i)`** (line 353):
   - After `await lockFn(...)` resolves, compare `i` to `room.current_correct_index`.
   - If wrong: add `i` to `wrongPicks`, fire `Haptics.wrong()` + `play("buzzer")` (or existing wrong sfx), do NOT advance phase, leave the tile tappable for another guess.
   - If correct: fire `Haptics.correct()` + small confirm sfx, keep current locked styling.

3. **Pass live feedback to `<AnswerGrid>`** (line 819 block):
   - `droppedIndexes={[...(room.dropped_indexes ?? []), ...wrongPicks]}` — wrong picks get the same greyed/✕ treatment that dropped tiles already have, locally only.
   - `correctIndex={ me?.current_answer === room.current_correct_index ? room.current_correct_index : null }` — green halo only once they actually land on the right one.
   - Keep `disabled={room.phase !== "question" || reading}` so they can keep tapping until they get it right or time runs out.

4. **Tiny "Try again" hint** under the grid while `wrongPicks.size > 0 && me?.current_answer !== room.current_correct_index` — single line, rose color, no layout shift. Hides as soon as they pick correctly.

## What is NOT changing
- `lockAnswer` server fn, scoring, streaks, `current_first_answer` (first pick already drives streak credit — wrong-then-right still loses streak, same as today).
- Host/TV reveal flow, leaderboard, explanation card.
- The `reveal`-phase correct/wrong banner at line 841.
- Final round (`pickFinal`) — untouched.

## Verification
- Pick wrong → tile greys with ✕ + buzzer immediately, other tiles stay live, "Try again" hint appears.
- Pick correct (first try or after a wrong) → tile glows green, hint disappears, no extra server calls.
- New question → `wrongPicks` clears, all four tiles live again.
- Host TV behavior and scoring identical to before.
