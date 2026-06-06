## Goal
After the correct answer is revealed, show a short explanation/fun fact about why it's correct.

## Changes

**1. Database**
- Add `explanation text` column to `public.questions` (nullable — existing rows stay blank).

**2. AI Question Generator** (`src/lib/admin.functions.ts`)
- Update the generation prompt + schema so every new question returns a 1–2 sentence `explanation` (a fact about why the correct answer is right).
- Persist `explanation` on insert.

**3. Reveal UI** (`src/components/host/QuestionStage.tsx` and player `play.tsx` reveal state)
- When the correct answer is shown (alongside the "who picked what" card), render a "Did you know?" panel with the explanation underneath.
- If `explanation` is null/empty (older questions), just hide the panel — no layout shift.

**4. Final round reveal** (`final_reveal` phase)
- Same treatment: show the explanation under the correct answer card.

## Existing questions
Left as-is (no explanation shown). Optional follow-up: a one-click "Backfill explanations" admin button that runs the AI over rows where `explanation IS NULL`. Not included in this plan unless you want it.

## Out of scope
- Backfilling old questions
- Editing explanations in the admin UI (can add later)
- Voice/audio narration of the fact