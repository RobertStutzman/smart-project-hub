## 1. Turn "Pittsburgh Sports" off by default

There's no `category_meta` row for "Pittsburgh Sports" (308 questions), so it currently appears in every host's default enabled set with the fallback ❓ emoji. Fix in one migration:

```sql
INSERT INTO category_meta (name, emoji, off_by_default)
VALUES ('Pittsburgh Sports', '🏟️', true)
ON CONFLICT (name) DO UPDATE
  SET off_by_default = true,
      emoji = EXCLUDED.emoji;
```

`mergedDefaultOffCategories()` in `src/lib/categories.ts` already reads this cache, so once seeded the host lobby picker will show it unchecked by default. No code change needed.

## 2. Category cleanup — proposed merges

Current DB has 32 distinct question categories with lots of overlap (fragmented from Gemini pastes over time). Proposed consolidation via `UPDATE questions SET category = ...`:

| Merge these                                                                                       | Into                  |
| ------------------------------------------------------------------------------------------------- | --------------------- |
| `All things Hollywood`, `Famous Hollywood Movies`, `Popular Movies`, `Comedy Classics`, `Movies & Music` | `Movies`              |
| `80's kids`                                                                                       | `Kids`                |
| `Science & Nature`                                                                                | `Science`             |
| `World History`                                                                                   | `History`             |
| `Twilight Saga` (only 20 Qs)                                                                      | `Movies`              |
| `MLB & NHL`, `Pittsburgh Sports`                                                                  | keep separate (niche, off-by-default) |

After merge, drop the emptied `category_meta` rows so they stop appearing in the picker:

```sql
DELETE FROM category_meta
WHERE name IN ('Movies & Music','Science & Nature','World History');
```

Result: ~32 → ~22 categories, no fragmented near-duplicates. This is one migration, ~10 minutes of work, and reversible from git history if you dislike a merge.

## 3. What I need from you before running #2

The merge list above is my best guess. Two things worth confirming:

- Are you happy with `Twilight Saga` → `Movies`, or would you rather keep it as its own tiny bucket?
- Any category I've left alone that you'd also like folded in (e.g. `Bar Trivia`, `Funny Facts`, `Gross facts`)?

If you just want #1 (Pittsburgh off-by-default) and want to skip cleanup for now, say "just #1" and I'll ship only the seed migration.

## Technical section

- Files touched: one new SQL migration under `supabase/migrations/`. No TypeScript changes required.
- Runtime behaviour: `listCategoryMeta()` runs on app mount, populates the cache, and `mergedDefaultOffCategories()` immediately reflects the new `off_by_default=true` row.
- Question rows keep their IDs during category renames, so play history / stats stay intact.
