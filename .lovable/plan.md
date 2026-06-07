## Goal
Let you add brand-new categories from the admin UI — no code changes, no asking me.

## Why it's stuck today
`src/routes/_authenticated/admin.tsx` renders the category field as a fixed `<select>` populated from the hardcoded `CATEGORIES` array in `src/lib/categories.ts`. Anything not in that array can't be picked. Same for the category filter at the top of the table and the AI-generator category dropdown.

The DB itself doesn't care — `questions.category` is just `text`. And we already have `listCategories()` (server fn) that returns every distinct category from the DB with counts. The host's Surprise Mix sheet already uses it; the admin pages just don't.

## Changes

**1. Admin question editor — free-type + suggestions**
- Replace the category `<select>` in `QuestionEditor` with an `<input list="...">` + `<datalist>`.
- Options come from a merged list: `listCategories()` results ∪ hardcoded `CATEGORIES`.
- You can pick an existing one OR type a new name; on save it's written as-is. First question saved with a new name creates the category implicitly.
- Trim + collapse whitespace before save so "Music " and "Music" don't split.

**2. Admin table — category filter**
- "All categories" dropdown also reads from `listCategories()` so newly created categories show up immediately for filtering (no page refresh needed beyond the existing reload after save).

**3. AI generator — category picker**
- Same treatment: datalist combining DB categories + hardcoded list, so you can generate a batch into a new category by typing its name.

**4. Tiny quality-of-life**
- Show category counts in the datalist labels where supported (e.g. `Music (142)`), purely informational.
- Niche/new categories you create are OFF by default in Surprise Mix unless added to `DEFAULT_OFF_CATEGORIES` — actually the opposite: new ones default ON (existing behavior). No change needed; just flagging so you know.

## Out of scope
- No DB migration (categories remain a free-text column).
- No dedicated "Manage categories" page (rename/merge/delete). If you ever want that, it's a separate plan — would need a bulk `UPDATE questions SET category=... WHERE category=...` flow.
- Emoji per new category stays as the default `❓` until you tell me what emoji to map (or we add an emoji input later).

## Files touched
- `src/routes/_authenticated/admin.tsx` — replace 2 selects with input+datalist, fetch categories via `listCategories()`.
- (no changes to `categories.ts`, server fns, or the host)