## Goal

Make question selection globally fair: a question only comes back after every other question (matching the same category + difficulty) has been used at least once across all games.

## 1. Schema migration

Add a usage counter + timestamp to `questions`:

```sql
ALTER TABLE public.questions
  ADD COLUMN times_used integer NOT NULL DEFAULT 0,
  ADD COLUMN last_used_at timestamptz;

CREATE INDEX questions_rotation_idx
  ON public.questions (category, difficulty, times_used, last_used_at NULLS FIRST);
```

No new grants needed (table is already SELECT-public; writes happen via `supabaseAdmin`).

## 2. Picker change — `src/lib/game.functions.ts`

In the two places that pick a question (`fetchPool` around lines 142 and 579):

- Keep the per-room exclusion (`room_questions` → no repeats inside one game).
- Replace `ORDER BY random()` (or current ordering) with:
  ```
  .order("times_used", { ascending: true })
  .order("last_used_at", { ascending: true, nullsFirst: true })
  ```
- Fetch a small top window (e.g. limit 8) of least-used candidates, then `Math.random()` pick one — so games don't feel mechanically deterministic but still respect the rotation.

## 3. Mark question as used

Right after we insert into `room_questions` and set `current_question_id` (lines ~171 and ~598), also bump the question:

```ts
await supabaseAdmin
  .from("questions")
  .update({ times_used: q.times_used + 1, last_used_at: new Date().toISOString() })
  .eq("id", q.id);
```

(Read `times_used` from the selected row; fall back to an RPC if we'd rather do an atomic `times_used + 1` — start with the simple update.)

## Result

- A brand-new question with `times_used = 0` and `last_used_at = NULL` is always preferred.
- Once every question in the (category, difficulty) pool has `times_used = 1`, the picker moves to the ones with the oldest `last_used_at`.
- Existing per-room "no repeats within one game" rule is unchanged.

No frontend changes.
