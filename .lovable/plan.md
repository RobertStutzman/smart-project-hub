# Admin question list is capped at 1000 (server-side)

## What's actually happening
- DB has **3,847 questions** — imports are working.
- `listQuestions` in `src/lib/admin.functions.ts` does `.select("*").order("created_at", desc)` with no range/pagination. PostgREST silently caps that response at 1,000 rows, so the admin table never shows more than 1,000 no matter how many you add.
- The header text `All questions (1000)` comes from `questions.length` on the client — it's the page size, not the true total.

## Fix

Two small changes, admin-only:

1. **`src/lib/admin.functions.ts` — `listQuestions`**
   - Fetch in chunks of 1000 using `.range(from, to)` in a loop until fewer than 1000 rows come back, then concatenate. Return `{ questions, total }`.
   - Also return an exact `count` via a `head: true, count: "exact"` query so the UI can show the true total even before all pages arrive.

2. **`src/routes/_authenticated/admin.tsx`**
   - Use the new `total` (or `count`) in the `All questions (N)` header instead of `questions.length`.
   - No UI redesign; table keeps rendering the full array (it's already virtualized-friendly enough at a few thousand rows).

## Out of scope
- No changes to CSV import limits, generation, or any gameplay code.
- No pagination UI redesign — can add later if the flat list gets sluggish past ~10k.
