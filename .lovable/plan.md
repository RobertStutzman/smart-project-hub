# Semantic duplicate detection for questions

## Problem

The existing "Repair duplicate answers" tool only fixes rows whose answer **options** duplicate each other (e.g. wrong_1 = correct_answer). The import-time `checkDuplicates` only matches near-verbatim question text (`dedupeKey`: lowercased, punctuation stripped). Neither catches the real problem: two questions that mean the same thing but are worded differently, e.g.

- "Who painted the Mona Lisa?"
- "Which Italian Renaissance artist created the Mona Lisa?"

Both share the same correct answer (`Leonardo da Vinci`) and ask the same thing — the second should be flagged as a dupe.

Currently there are 1,415 questions. Many candidate groups already exist (e.g. 5 questions in "80's Music" with correct answer "Journey").

## Approach

Two-part feature: an admin **scanner** with manual review, and an **insert-time blocker** that prevents new semantic dupes from entering the DB.

### Part A — Scanner (server + UI)

**1. New server function `findSemanticDuplicates` in `src/lib/admin.functions.ts`**

- Admin-gated (`assertAdmin`).
- Input: `{ category?: string; offset?: number; limit?: number }` — process in chunks so we can show progress.
- Algorithm:
  1. Load `id, category, question_text, correct_answer` for the target category (or all categories).
  2. Bucket rows by `(category, normalize(correct_answer))` where `normalize` lowercases, trims, collapses whitespace, strips punctuation. Reuse a `normalizeAnswer` helper exported alongside `dedupeKey`.
  3. Drop buckets with <2 rows (nothing to dedupe).
  4. For each remaining bucket, call Lovable AI Gateway via the shared provider helper:
     - Model: `google/gemini-3-flash-preview`.
     - `generateText` with `Output.object({ schema: z.object({ groups: z.array(z.array(z.string())) }) })` — each inner array is a set of question IDs that ask the same thing. Singletons are omitted by the model.
     - Prompt: "Here are questions that all share the same correct answer. Group together the ones that ask the SAME thing (just worded differently). Two questions are the same if a player who knows the answer to one would answer the other identically. Different angles on the same fact (e.g. 'capital of X?' vs 'where is the Eiffel Tower?') are NOT the same." Pass `[{id, question_text}]` JSON in.
     - Skip buckets with >12 entries by splitting into chunks (rare; cap chunk at 12 to keep schemas small).
  5. Return `{ groups: Array<{ category, correct_answer, items: Array<{ id, question_text }> }>, scanned, totalBuckets }`.

**2. New server function `deleteQuestionsByIds`**

- Admin-gated, input `z.object({ ids: z.array(z.uuid()).min(1).max(500) })`.
- `supabaseAdmin.from("questions").delete().in("id", ids)`.
- Returns `{ deleted }`.

**3. Admin UI panel in `src/routes/_authenticated/admin.tsx`**

Add a new section "🔍 Find semantic duplicates" near the existing "Repair duplicate answers" panel:
- Category selector (re-use the existing `CategoryOption` list) + "All categories" option.
- "Scan" button → calls `findSemanticDuplicates` with progress toast (chunks of 200 questions or 25 buckets per call).
- Results render as collapsible groups:
  - Header: `Category · "correct answer" · N matches`
  - For each item: question text + a radio button to mark "keep" (default: longest text). Other items default-checked for deletion. User can override.
  - Per-group "Delete N" button → calls `deleteQuestionsByIds` with the unchecked IDs, removes the group from state, toasts confirmation.
  - "Delete all selected across groups" sticky footer button for bulk action.
- No auto-delete. Manual only.

### Part B — Insert-time blocking

**4. Within-batch dedupe in `generateQuestions` (already in `admin.functions.ts`)**

After the model returns a batch but before insert:
- Bucket the generated rows by `(category, normalizeAnswer(correct_answer))`.
- For buckets with >1 generated row, run the same AI semantic-check call as above. Drop all but the first row from each detected dupe group. Log the count.

**5. Cross-batch dedupe (against existing DB)**

For each generated row, after the within-batch pass:
- Query `SELECT id, question_text FROM questions WHERE category = $1 AND lower(correct_answer) = $2 LIMIT 12`.
- If matches exist, ask the AI: "Does the new question ask the SAME thing as any of these existing questions?" Return `{ duplicate_of: string | null }`. If non-null, skip insert.
- To keep latency reasonable, batch this across all incoming rows in one AI call when feasible (group by `(category, answer)`).

Return value of `generateQuestions` gains `{ inserted, skippedSemanticDupes }` so the UI toast can show "Inserted 47 · 3 skipped as dupes."

## Out of scope

- Embeddings + pgvector (heavier infra, schema migration, re-embed on edit). Can revisit if AI calls become too slow/expensive.
- Auto-deletion of detected dupes. Manual review only this round.
- Backfill of `dedupeKey` into a DB column (not needed — bucketing happens in memory).
- Touching the existing "Repair duplicate answers" tool — it solves a different problem (same-row answer collisions).

## Verification

- Scan "80's Music" → should surface the existing "Journey" / "Madonna" / "Police" buckets and group genuine reworded duplicates while leaving distinct-but-same-answer questions alone.
- Mark some for deletion, hit Delete → rows removed from DB, group disappears, leaderboard category counts update.
- Generate a fresh batch where two prompts produce reworded versions of "Who painted the Mona Lisa?" → toast reports `skippedSemanticDupes > 0`, only one row lands in the DB.
- Generate a batch whose questions semantically match an existing DB row → that row is skipped, existing row preserved.
- Non-admin user calling either server function → 403/error.

## Cost / latency note

Each scan and each insert costs Lovable AI credits proportional to the number of answer-buckets with multi-row collisions, not total question count. For 1,415 questions today and typical batch sizes the per-scan cost is small (tens of short Gemini Flash calls). UI shows a progress toast and the user can cancel between chunks.
