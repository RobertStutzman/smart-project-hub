## Goal

Add a **paste-and-import** flow on the Admin page so you can generate questions in Gemini (or anywhere else, for free) and bulk-import them into the app. Then trigger your existing TTS bake-off so each imported question gets premium voice narration.

No credits spent on question generation — only on the (already existing) TTS bake.

## The flow

1. You open Gemini, paste the prompt template the app gives you, and tell Gemini your category/count/difficulty.
2. Gemini returns a JSON array of questions in the exact shape the app expects.
3. You paste that JSON into the new **"Import from Gemini"** panel on `/admin`.
4. Click **Validate** → app parses, checks each question (4 distinct answers, valid difficulty, required fields), and shows ✅/❌ per row with inline error messages.
5. Click **Import N questions** → bulk insert into the `questions` table.
6. A checkbox **"Generate TTS after import"** (on by default) automatically runs `bakeAllQuestionTTS` for the newly inserted rows so voice narration is ready before the next game.

## The Gemini prompt (shown in the UI with a copy button)

```text
You write trivia questions for a live multiplayer game. Generate {N} questions
in the category "{CATEGORY}" at "{DIFFICULTY}" difficulty.

Rules:
- Exactly one correct answer + three plausible, distinct wrong answers.
- 1–2 sentence "explanation" (under 200 chars) — a fun fact a host would read.
- difficulty: easy | medium | hard | impossible
- No duplicates. No trick questions. Keep wording crisp.

Return ONLY a JSON array (no prose, no markdown fences) of objects matching:
[
  {
    "category": "string",
    "question_text": "string",
    "correct_answer": "string",
    "wrong_1": "string",
    "wrong_2": "string",
    "wrong_3": "string",
    "explanation": "string",
    "difficulty": "easy|medium|hard|impossible"
  }
]
```

The UI lets you fill `{N}`, `{CATEGORY}`, `{DIFFICULTY}` and copies the rendered prompt to clipboard.

## Validation rules (matches the app's existing schema)

- Top-level must be a JSON array (also tolerate `{ "questions": [...] }` since Gemini sometimes wraps it).
- Strip markdown code fences (```json ... ```) before parsing — Gemini loves to add them.
- Each row runs through the existing `QuestionInput` Zod schema + `answersAreDistinct` check.
- Invalid rows are flagged but don't block valid ones. You can deselect any row before importing.

## Files to change

1. **`src/lib/admin.functions.ts`** — add one new server function:
   - `bulkImportQuestions({ questions: QuestionInput[] })` — admin-gated, batch-inserts via `supabaseAdmin.from("questions").insert(rows).select("id")`, returns the new IDs. Reuses the existing `QuestionInput` schema and `answersAreDistinct` check.

2. **`src/routes/_authenticated/admin.tsx`** — add a new collapsible **"Import from Gemini"** panel above (or beside) the existing AI generator with:
   - Category / count / difficulty inputs
   - Rendered prompt + **Copy prompt** button
   - Large textarea for pasting Gemini's JSON output
   - **Validate** button → client-side parse + per-row status list (✅ / ❌ with reason)
   - Row-level checkbox to skip bad ones
   - **"Generate TTS after import"** checkbox (default on)
   - **Import** button → calls `bulkImportQuestions`, then (if checkbox on) calls the existing `bakeAllQuestionTTS({ force: false })` and shows a toast with counts.

3. **No DB / schema changes.** The `questions` table already has every field used.
4. **No edge functions.** This is pure server-fn + client UI.

## Non-goals

- No file upload (you said paste; we can add upload later in 10 minutes if you want).
- No Gemini API integration (you're pasting from the Gemini web app — zero credits, zero keys).
- No change to game logic, host UI, or scoring.

## Validation

- Paste a valid Gemini JSON of 5 questions → all 5 show ✅, import succeeds, rows appear in the existing questions list, TTS bake kicks off, toast confirms.
- Paste invalid JSON / wrapped in code fences → fences stripped, parses cleanly.
- Paste a question with duplicate answers → that row shows ❌ with reason; the rest still import.
