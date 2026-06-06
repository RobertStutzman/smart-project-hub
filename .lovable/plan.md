# Backfill "Did you know?" for every question

Goal: every existing question gets a `explanation` stored in the database (one-time AI cost). Gameplay continues to read straight from the row — **zero AI calls during games**, even at a million users.

New question generation already includes `explanation` in the required AI output, so future questions are covered automatically.

## What gets built

### 1. Two new server functions in `src/lib/admin.functions.ts`

- `countMissingExplanations()` — returns how many questions still need one.
- `backfillExplanations({ batchSize })` — picks up to N questions where `explanation IS NULL OR explanation = ''`, sends them to the Lovable AI gateway in a single batched call, and writes the result back to each row's `explanation` column. Returns `{ processed, updated, remaining, done }`. Idempotent and safely re-runnable.

Batch size 15 per call, so each click handles 15 questions and the UI loops until `done`.

### 2. Admin UI button in `src/routes/_authenticated/admin.tsx`

A "Backfill explanations" panel near the AI generator that shows:
- "N questions missing an explanation"
- A button that loops `backfillExplanations` until `remaining === 0`, with a live progress toast ("Updated 15… 30… 45 / 120").
- Disabled when nothing is missing.

### 3. No schema changes

`questions.explanation` already exists. Gameplay code (`startNextRound`, `startFinalRound`, reveal UIs) already reads and displays it — no changes needed there.

## Cost & scale

- One-time cost: ~1 AI call per ~15 existing questions. For a few hundred questions that's pennies.
- After backfill: **0 AI calls per game**. Explanations are plain text columns served by Postgres like any other field.
- New questions: explanation is generated at the same time as the question (already implemented), still one-time only.

## Out of scope

- Overwriting existing explanations (only fills empty ones).
- Per-question "regenerate explanation" button (can add later if you want).
