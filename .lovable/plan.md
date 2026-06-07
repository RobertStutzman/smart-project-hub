## The bug

When the host picks "80's Music", players see Sci-Fi questions. Cause: the question-picker's fallback chain abandons the chosen category too eagerly.

DB reality: "80's Music" has 20 questions, all `medium` difficulty. Movie Sci-Fi has 141 questions spread across easy/medium/hard/impossible. The picker rotates through difficulties (easy → medium → hard → impossible) trying to balance them. When it targets `easy`/`hard`/`impossible` and 80's Music has none, the current fallback order is:

1. target difficulty + category
2. target difficulty, any category ← jumps to Sci-Fi here
3. any difficulty + category
4. any difficulty, any category

So as soon as a non-medium round comes up, it leaves 80's Music for Sci-Fi.

## Fix

Swap the fallback priority in `src/lib/game.functions.ts` so the selected category is preserved before opening up to other categories.

**Normal rounds (around line 170):**
1. target difficulty + category
2. **any difficulty + category** (was step 3)
3. **target difficulty, any category** (was step 2)
4. any difficulty, any category

**Final round (around line 648):** apply the same reordering to the `attempts` array — try `impossible/hard in category` → `any difficulty in category` → `impossible/hard any category` → `any`.

This keeps the game inside the chosen category whenever any question remains there, and only crosses categories when that category is truly exhausted.

## Out of scope

Not touching the category list, the difficulty-rotation logic, or seeding more 80's Music questions — that's content work, separate from this bug.