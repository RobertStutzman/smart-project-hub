## Goal

Replace the "pick one category per round" model with a hidden-pool "Surprise Mix" by default, while still letting hosts opt into a multi-select category filter from the lobby — Jackbox/HQ style.

Important context: the DB has 10 categories (Movie Sci-Fi, Movies, Music, General Knowledge, 80's Music, Geography, TV Shows, Sports, Science, History). The current hardcoded picker only exposes 4 + Mystery Mix, so most questions are unreachable today. This change also fixes that.

## What the host will see

Lobby (instead of the current category grid):
- Big primary button: `▶ Press OK to start the show` (already in place from Phase 1).
- Underneath, a subtle pill button: `🎲 Surprise Mix · 8 categories on` → opens a bottom sheet.
- Sheet: list of all categories with checkboxes, "Select all / none" links, and a Save button. Persists to localStorage (`btd:enabled-categories`) and writes to the room so all clients agree.
- Niche categories (default-off for new hosts): `Movie Sci-Fi`. Everything else on by default.
- Removes the per-round "Pick a category" grid entirely. `current_category` becomes informational only (shown on the question card as "Category: Sports") — it's set per-question from whatever was drawn.

## Data model

Add one column to `rooms`:
- `enabled_categories text[]` — nullable. `null` = use all categories. Non-null = restrict pool to this list.

No data migration needed. Existing rooms stay valid.

## Question selection logic (`src/lib/game.functions.ts`)

Replace the `useCategory` branch in `fetchPool`:
```
if (enabledCategories?.length) qQuery = qQuery.in("category", enabledCategories);
```
Fallback chain becomes:
1. target difficulty within enabled set
2. any difficulty within enabled set
3. target difficulty across all categories (safety net if the pool is exhausted)
4. anything

After a question is drawn, write its category to `rooms.current_category` so the host UI and announcer voice lines still have something to display.

## Category list

Stop hardcoding categories in `src/lib/categories.ts`. Replace with:
- `DEFAULT_OFF_CATEGORIES = ["Movie Sci-Fi"]`
- A new server fn `listCategories()` that returns `{ name, count }[]` from `SELECT category, COUNT(*) FROM questions GROUP BY category`.
- Lobby fetches this on mount so new categories I add later show up automatically.

`MIX_CATEGORY` and the `CATEGORIES` array are removed (no callers left after the host refactor). The premium-paywall modal stays but is unused for now; I'll leave it in place for the future per-category premium gating.

## Files touched

- `supabase migration` — add `enabled_categories text[]` to `rooms`.
- `src/lib/categories.ts` — replace with `DEFAULT_OFF_CATEGORIES` + types.
- `src/lib/rooms.functions.ts` — new `listCategories()` + `setEnabledCategories(roomId, categories[])` server fns.
- `src/lib/game.functions.ts` — swap `eq("category")` for `in("category", enabled)`, update fallback chain.
- `src/routes/host.tsx` — remove category grid; add Surprise Mix pill + bottom sheet with checkboxes; load defaults from localStorage; save to room on change.
- `src/components/host/QuestionStage.tsx` (only if it shows the picker label) — show current question's category as a small badge.

## Out of scope

- Global admin default for category exclusions — skipping per your answer ("host settings only").
- Theme packs / curated bundles.
- Per-category premium gating (paywall modal stays dormant).

## Open follow-up

`Chapter & Verse` (Bible) is referenced in `categories.ts` but has zero rows in the DB — so it'll naturally disappear when the lobby reads from the DB. If you want it to come back later, just add questions with that category name and it'll auto-appear in the sheet.
