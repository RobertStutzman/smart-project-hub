## Goal
Show "Chapter & Verse" (and any other hardcoded category) in the host's Surprise Mix settings sheet even when zero questions exist in the DB yet — so you can see it as a placeholder.

## Why it's missing today
`listCategories()` returns only categories that have at least one row in `questions`. The host settings sheet builds its checklist from that result. Since you haven't saved any Chapter & Verse questions yet, the DB has 0 rows for it, so it's filtered out.

## Changes

**1. `src/routes/host.tsx` — merge hardcoded list into the picker**
- In the `listCategoriesFn` effect, merge the DB result with `CATEGORIES` from `src/lib/categories.ts` (excluding `Mystery Mix`), so any hardcoded category shows up with `count: 0` even when empty.
- Sort alphabetically.
- Render empty ones with a muted "(empty)" tag in the sheet, and disable the checkbox (or keep enabled but the host knows it'll contribute nothing). Disabling is clearer — prevents enabling a category that draws nothing.
- `DEFAULT_OFF_CATEGORIES` keeps "Chapter & Verse" off by default; existing behavior preserved.

**2. No DB/server changes**
- `listCategories()` still returns only categories with rows (correct for the AI generator/admin filter labels).
- The merge happens client-side in the host route only.

## Out of scope
- Adding actual Verses questions — you'll do that on `/admin` (free-text category input is already wired up from the previous change).
- Renaming "Chapter & Verse" — name stays as-is per your answer.

## Files touched
- `src/routes/host.tsx` — merge hardcoded `CATEGORIES` into `allCategories`, gray out + disable categories with `count === 0` in the settings sheet.