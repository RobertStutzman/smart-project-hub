## Changes

**1. Rename "Bible" → "Chapter & Verse"** in `src/lib/categories.ts`. Emoji stays 📖.

**2. Add "Mystery Mix" 🎲** as a new category in the same file. This is a sentinel category — questions are drawn from the entire question bank, ignoring the category filter.

**3. Wire the mix behavior in `src/lib/game.functions.ts`** (lines 158 and 657): when `room.current_category === "Mystery Mix"`, skip the `.eq("category", ...)` filter so the picker pulls from any category. Same treatment in both the regular question picker and the final-round fallback chain.

**4. Gemini importer** (`src/routes/_authenticated/admin.tsx`): exclude "Mystery Mix" from the category dropdown since you don't author questions tagged with that name — they get mixed in at runtime from real categories.

No DB changes needed. Existing questions stay tagged with their real category; Mystery Mix is purely a room-level "draw from anywhere" mode.