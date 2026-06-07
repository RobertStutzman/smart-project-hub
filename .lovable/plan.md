## Goal

Make every newly-added question automatically generate its "Did you know?" Elf narration, so we never have to remember to click the admin backfill button again.

## Current state

- Inserting questions (JSON paste, AI generate, Gemini paste) already triggers `bakeAllQuestionTTS` to bake the **question prompt** voiceover when the "Bake voice for new questions" checkbox is on (default: on).
- The new `bakeAllExplanationTTS` for the **Did you know?** narration only runs from the dedicated "Narrate Did You Knows" button in admin — new questions get skipped until someone clicks it.

## Change

In `src/routes/_authenticated/admin.tsx`, wherever we currently call `bakeAllQuestionTTS` after an insert (3 sites: JSON import, AI generate, Gemini paste), immediately follow with a `bakeAllExplanationTTS` call gated by the same `bakeTts` checkbox.

- Same batch size pattern (limit ~50–100, matching question-bake batch).
- Same toast pattern: "Did You Knows baked: X new, Y already done".
- Errors from explanation bake are non-fatal — questions are already inserted and prompt TTS already baked.
- Relabel the checkbox to "Bake Elf voice for new questions (prompt + Did you know?)" so the UI matches behavior.

No schema changes, no host-side changes, no changes to the existing manual backfill button (still useful for re-baking after edits).

## Files

- `src/routes/_authenticated/admin.tsx` — 3 insert handlers + checkbox label.
