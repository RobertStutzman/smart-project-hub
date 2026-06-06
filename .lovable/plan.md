
# Fix duplicate answer options + prevent it forever

## The bug

19 of 268 existing questions have a `wrong_*` answer that equals the `correct_answer` (case-insensitive). When the grid renders `[correct, wrong_1, wrong_2, wrong_3]` shuffled, players see the same option twice — which is both a giveaway and a UX bug. The AI generator occasionally produces these, and nothing currently blocks them.

## Fix — three layers

### 1. Database guardrail (prevents future bad rows at the lowest level)

New migration adds a CHECK constraint on `public.questions`:

```sql
ALTER TABLE public.questions
  ADD CONSTRAINT questions_distinct_answers CHECK (
    lower(trim(correct_answer)) <> lower(trim(wrong_1))
    AND lower(trim(correct_answer)) <> lower(trim(wrong_2))
    AND lower(trim(correct_answer)) <> lower(trim(wrong_3))
    AND lower(trim(wrong_1)) <> lower(trim(wrong_2))
    AND lower(trim(wrong_1)) <> lower(trim(wrong_3))
    AND lower(trim(wrong_2)) <> lower(trim(wrong_3))
  );
```

Existing bad rows are repaired first (step 3) so the constraint adds cleanly. CHECK is safe here — the rule is immutable.

### 2. Server-side validation (catches it before the DB call, gives a clean error)

In `src/lib/admin.functions.ts`:

- Add a Zod `.superRefine()` on `QuestionInput` that rejects duplicate answers (same rule as the CHECK).
- In `generateQuestions`: after the AI returns, **filter out** any question whose 4 answers aren't all distinct (case-insensitive). If the requested count isn't met, return what's valid with a `skipped` count so the admin sees "AI returned 10, 1 had duplicates and was dropped" instead of silently inserting a bad row.
- `upsertQuestion` and `bulkInsertQuestions` inherit the refinement automatically.

### 3. Backfill the 19 existing bad rows

New admin server function `repairDuplicateAnswers({ batchSize: 10 })`, parallel to the explanation backfill:

- Selects up to N rows where any answer is duplicated.
- Sends them to the Lovable AI Gateway with a tool-call asking it to **rewrite only the wrong answers** (keep question, correct answer, explanation, category, difficulty intact) so all 4 are plausible and distinct.
- Validates the AI response with the same distinctness rule. Updates rows that pass.
- Returns `{ processed, updated, remaining, done }` — UI loops until done.

New admin UI panel in `src/routes/_authenticated/admin.tsx` next to the explanation backfill: shows "N questions with duplicate answers" + "Repair duplicates" button with live progress toast. Hidden when 0.

## Order of operations in the migration turn

1. Add `repairDuplicateAnswers` + `countDuplicateAnswers` server functions + admin UI panel.
2. Run the repair from the UI until 0 remain. (Manual step — you click the button.)
3. After 0, ship the CHECK constraint migration.

If you'd rather not wait for a manual click, I can also have the migration itself attempt a SQL-level repair (append a numbered suffix to the duplicate wrong answer as a last-resort fallback) so the constraint can apply immediately and the AI repair becomes nice-to-have polish. Let me know which you prefer.

## Out of scope

- Reworking the answer-grid rendering (it's correct; it just gets bad data).
- Detecting semantic near-duplicates (e.g., "Doctor Strange" vs "Dr. Strange") — only exact, case-insensitive, trimmed match.

## Files

- new: `supabase/migrations/<ts>_questions_distinct_answers.sql`
- `src/lib/admin.functions.ts` — Zod refinement, `generateQuestions` filtering, `repairDuplicateAnswers`, `countDuplicateAnswers`
- `src/routes/_authenticated/admin.tsx` — new "Repair duplicate answers" panel
