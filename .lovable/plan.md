## Auto-register new categories from Gemini imports (emoji + metadata)

Today the data flows through fine, but new categories show ❓ until someone edits `src/lib/categories.ts`. This plan makes the importer fully self-serve: paste a Gemini batch with any new category and it gets a real emoji and is wired into the rest of the app automatically.

### Approach

Add a tiny `category_meta` table that the app reads alongside the hardcoded list. The importer auto-creates a row for any unknown category, picking an emoji via Lovable AI in one quick call.

### Schema (new migration)

```sql
CREATE TABLE public.category_meta (
  name           text PRIMARY KEY,
  emoji          text NOT NULL DEFAULT '❓',
  off_by_default boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.category_meta TO anon, authenticated;
GRANT ALL    ON public.category_meta TO service_role;
ALTER TABLE public.category_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.category_meta FOR SELECT USING (true);
-- writes go through admin server fns only (service_role / admin-gated)
```

Seed the existing hardcoded categories so nothing regresses (Kids → `off_by_default = true`).

### Server function

`ensureCategoryMeta(name)` in `src/lib/admin.functions.ts` (admin-gated):
1. If a row exists → return it.
2. Else call Lovable AI (`google/gemini-3-flash-preview`, structured `Output.object({ emoji: z.string() })`) with a tight prompt: *"Pick a single emoji that best represents the trivia category '<name>'. Reply with just the emoji."*
3. Insert `{ name, emoji, off_by_default: false }` via `supabaseAdmin`.

### Importer hook

In `GeminiImporter.handleImport` (admin.tsx ~line 2050), after parsing rows and before the final bulk insert: collect distinct categories present in the batch, dedupe against `CATEGORIES`, call `ensureCategoryMeta` for each unknown one in parallel. Show a toast like `Added 1 new category: 🐶 Pets`.

### Read path

- `emojiForCategory(name)` (in `src/lib/categories.ts`) → keep hardcoded list as fallback, but consumers now read from a small client cache populated by a new public `listCategoryMeta()` server fn (queried once on app load, invalidated after import).
- `DEFAULT_OFF_CATEGORIES` → merge hardcoded + any `category_meta` rows where `off_by_default = true`.
- Wire both into the Surprise Mix / host pickers that currently call `emojiForCategory` and `DEFAULT_OFF_CATEGORIES`.

### Not in scope
- No admin editor UI for emojis (you can update rows manually if needed; we can add a real editor in a follow-up).
- No bulk backfill — only new imports trigger the AI call. Existing categories are seeded by the migration.
- No change to the hardcoded `CATEGORIES` list — it stays as the static seed/fallback.

### Verification
- Paste a Gemini batch with `"category": "Pets"` → toast shows the auto-picked emoji, questions insert, host lobby shows "🐶 Pets" with its count.
- Re-paste same category → no new AI call (row already exists).
- Kids still off by default in Surprise Mix.
- Existing categories unchanged.
