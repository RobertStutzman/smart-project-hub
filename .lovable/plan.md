## Goal
Final round question must come from a hard/impossible pool. We don't track difficulty today, so add it.

## Changes

**1. Database**
- Add `difficulty text NOT NULL DEFAULT 'medium'` to `public.questions` with a CHECK constraint allowing `'easy' | 'medium' | 'hard' | 'impossible'`.
- Index on `(category, difficulty, is_premium)` to keep the final-round query fast.
- Existing rows default to `'medium'` (i.e., they will NOT be used for the final round until reclassified).

**2. AI Question Generator** (`src/lib/admin.functions.ts` + `admin.tsx`)
- Add a "Difficulty" dropdown (easy / medium / hard / impossible / mixed) to the generator form.
- Pass it to the server fn. Update the system prompt to calibrate to the requested level, and have the tool schema return a `difficulty` per question (so "mixed" still labels each one).
- Persist `difficulty` on insert.

**3. Final round picker** (`src/lib/game.functions.ts`, the `startFinalRound` handler)
- Change the question query to: same category (if any) AND `difficulty IN ('hard','impossible')`, excluding already-used IDs.
- Fallback chain if none found:
  1. hard/impossible in any category
  2. any difficulty in current category
  3. any question (current behavior)
- Pick `impossible` over `hard` when both are available (small weighting) so the final feels climactic.

**4. Admin question list**
- Show a difficulty badge per row.
- Allow inline edit via the existing edit dialog (add the dropdown).

## Out of scope
- Auto-reclassifying existing questions (you can re-generate or edit a batch via admin).
- Per-round difficulty curves for rounds 1-14.