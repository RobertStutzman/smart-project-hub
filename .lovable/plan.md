## Add DB duplicate detection on import

Currently `dedupeKey()` only dedupes within the staging panel — pasting questions that already exist in the database silently inserts duplicates. With hundreds of questions across many pastes, this gets messy fast.

### Plan

**1. New server fn `checkDuplicates`** (`src/lib/admin.functions.ts`)
- Input: `{ keys: string[] }` (normalized question text keys, max ~5000).
- Loads `id, question_text, category` for all existing questions, normalizes each with the same `dedupeKey` logic, and returns a `Set` (as array) of keys that already exist plus a small sample `{ key → { id, category } }` for display.
- Auth-protected via `requireSupabaseAuth` + admin check, same as the other admin fns.

**2. Share `dedupeKey`**
- Move `dedupeKey` from `admin.tsx` into a shared module (e.g. `src/lib/dedupe.ts`) so client and server normalize identically (lowercase, strip punctuation, collapse whitespace). Both sides import from there.

**3. Staging panel changes** (`src/routes/_authenticated/admin.tsx`)
- On mount + after each successful import, call `checkDuplicates` with all existing DB keys (one call, cached in state as `dbKeys: Set<string>`).
- When adding a pasted batch: keys are checked against both `staged` and `dbKeys`. Rows that hit `dbKeys` are dropped with a toast: *"Skipped 7 already in database, 3 already staged, added 40."*
- Each staged row also gets an `isDbDuplicate` flag rendered as a small ⚠️ badge ("Already in DB — [category]") in the staging list so the user can see which were filtered and why. Filtered rows are excluded from insert.

**4. Toast/banner summary**
- The existing "Added X · skipped Y duplicates" toast is extended to break out staging-dupes vs DB-dupes separately.

### Out of scope
- Fuzzy/semantic dedupe (e.g. "Who painted Mona Lisa?" vs "Who is the Mona Lisa's painter?"). This is exact-normalized-text only. We can layer trigram or embedding similarity later if it's actually a problem.
- Cross-category dedupe rules (a question is considered a duplicate regardless of category — that matches current `dedupeKey` behavior).

### Files
- `src/lib/dedupe.ts` (new) — shared `dedupeKey`.
- `src/lib/admin.functions.ts` — add `checkDuplicates` serverFn.
- `src/routes/_authenticated/admin.tsx` — wire it into the staging panel.
