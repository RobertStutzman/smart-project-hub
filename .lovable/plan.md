## Change

On the player phone, drop the question-text banner during normal rounds and let the 4 answer buttons own the whole screen. Players read the question on the TV.

### `src/routes/play.tsx` — `question` / `reveal` branch (~lines 571–589)

- Remove the question-text banner entirely.
- Replace it with a slim top strip that only shows:
  - "Question" label (or wildcard label like "Roast vote")
  - The countdown / "Read… Ns" timer
- Strip is ~one line tall so the `AnswerGrid` (already `flex-1`) grows to fill nearly the full screen → bigger buttons automatically.

### `src/routes/play.tsx` — final round (~lines 529–547)

- Same treatment: keep the "★ Final · wagered N" + timer chip, drop the question text. Players look at the TV.

### `src/components/AnswerGrid.tsx`

- Promote answer **labels** to the hero of each tile: `text-xl sm:text-2xl font-bold leading-tight`, up to 3 lines, padded.
- Demote A/B/C/D to a small chip in the top-left corner so the label has room.
- Shrink the faded background shape so it doesn't compete with the label.

No backend, no game-logic changes — purely the player-phone presentation.
