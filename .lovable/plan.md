## Funniest Moments: show actual dumb answers, not just avatars

Today the "Funniest Moments" section is just a polaroid wall of generic awards (Champion, Brain of the Night, Fastest Finger, etc.). The user expects it to show the actual wrong picks players locked in — e.g. *"Sarah → 'Tokyo' (it was 'Paris') — Capital of France."*

### Approach
Capture wrong picks during the game in the host tab's memory, then render them as the new "Funniest Moments" wall. No DB schema change — the credits screen runs in the same `HostGameStage` session, so a `useRef` accumulator is enough and avoids a new table + RLS work.

### Capture (in `HostGameStage.tsx`)
Add a `wrongPicksRef` shape:
```ts
type WrongPick = {
  questionId: string;
  questionText: string;
  correctText: string;
  picks: { sessionId: string; nickname: string; pickedText: string }[];
};
```
New effect, fires once per question when `phase === "reveal" && current_correct_index !== null`:
- Compute every non-audience player whose `current_answer !== null && !== correct_index`.
- Map each to `{ sessionId, nickname, pickedText: state.current_answers[current_answer] }`.
- Push a `WrongPick` keyed by `current_question_id` (guarded by a `Set<string>` ref so realtime re-emits don't double-add).

Pass the accumulated list into `<CreditsStage wrongPicks={wrongPicksRef.current} ... />`.

Optional: also capture the final-round reveal (`final_reveal`) using `final_answer` per player, since those are often the most dramatic misses.

### Render (in `CreditsStage.tsx`)
Replace the polaroid wall under "Funniest Moments" with the dumb-answer wall. Move the existing award polaroids into a renamed section above ("Tonight's Awards") so we don't lose them — the user only complained about Funniest Moments.

For each card on the wall (pick 4-6 of the funniest — e.g. most-confidently-wrong: questions where multiple players picked the same wrong answer, ties broken by round order):
- Question text (small, italic, top).
- Player nickname + avatar chip.
- Big "They said: **{pickedText}**" (rose/red tint).
- Small "Actually: {correctText}" (emerald tint).
- Slight rotation for the polaroid feel, same `rotationsRef` pattern already in the file.

If there are zero wrong picks (lucky round), hide the section.

### Persona / vox
No new TTS work. The existing credits music + intro line stays.

### Out of scope
- No DB migration or `player_answers` table — purely session-memory.
- No changes to the Highlight Reel, Cast, or other credits sections.
- No mid-game UI changes.

### Edge cases
- Audience members excluded.
- Players who joined late and didn't answer a given Q are excluded.
- A wrong pick that matches the *only* other player's pick is fine — still listed.
- If the host refreshes during play, in-memory data is lost (acceptable trade-off; documented).
