## Add "Kids" category to the app

Single-file change in `src/lib/categories.ts`:

- Add `{ name: "Kids", emoji: "🧒", isPremium: false }` to the `CATEGORIES` array (placed near the other family-friendly entries, before `MIX_CATEGORY` which must stay last).

That's it. Effects across the app come for free because everything reads from this list / the DB:

- **Admin question form** — "Kids" appears in the category dropdown with 🧒.
- **Host pickers & Surprise Mix lobby toggles** — `listCategories()` already pulls categories from the DB via `list_question_categories()`, so once Kids questions exist they'll show up; the hardcoded entry ensures the 🧒 emoji is used everywhere (lobby chips, in-game header, results) instead of the fallback ❓.
- **AI generator + Gemini importer** — already category-agnostic; no change needed.
- **Semantic dedupe scanner** — already iterates categories from the DB; will pick Kids up automatically.

### Not in scope
- No DB migration (category is just a `text` column on `questions`, no enum).
- No changes to `DEFAULT_OFF_CATEGORIES` — Kids is on by default in Surprise Mix so families get it without extra setup. Say the word if you'd rather have it opt-in.
- No seeding/import work — you confirmed questions are already imported.

### Verification
- Open the admin form → category dropdown shows "🧒 Kids".
- Host lobby → Surprise Mix categories list shows "🧒 Kids" with its question count.
- Start a round forced to Kids → header chip renders 🧒 (not ❓).
