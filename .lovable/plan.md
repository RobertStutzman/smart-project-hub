## Fix vanishing categories at scale

### Problem
`listCategories` does `supabase.from("questions").select("category")` which is capped at 1000 rows. Past 1000 questions, any category whose rows fall outside that window disappears from the host's picker.

### Fix
Replace the row-fetch-and-count with a real DB-side aggregation via a `SECURITY DEFINER` Postgres function. One round-trip, returns one row per category with its count — scales to millions of rows.

**Migration** — add function:
```sql
CREATE OR REPLACE FUNCTION public.list_question_categories()
RETURNS TABLE(name text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT category::text AS name, COUNT(*)::bigint AS count
  FROM public.questions
  WHERE category IS NOT NULL AND category <> ''
  GROUP BY category
  ORDER BY category;
$$;
GRANT EXECUTE ON FUNCTION public.list_question_categories() TO authenticated, service_role;
```

**Code** — `src/lib/rooms.functions.ts` `listCategories`:
Swap the `.from("questions").select("category")` block for `supabaseAdmin.rpc("list_question_categories")`, map rows to `{ name, count: Number(count) }`, keep the same return shape `{ categories: [...] }`.

### Out of scope
- No UI changes — the host picker reads the new full list automatically.
- No changes to question filtering / Surprise Mix selection logic.