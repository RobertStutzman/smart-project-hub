# Content ratings + join/enter-room load error

## What's actually happening today

**1. Ratings don't filter questions — at all.**
I checked `src/lib/game.functions.ts` and `src/routes/host.tsx`. The PG / PG-13 / MA 18+ picker only does two things:
- Swaps the *announcer voice pool* (family Elf vs. rude Elf + Sasha).
- Hard-locks the single `Adults Only` category unless MA is selected.

Every other question in the DB is treated as family-safe regardless of rating. There is no `rating` / `age_rating` column on `questions`, and no PG-vs-PG-13 split. So "PG" and "PG-13" are currently identical for question content — the label is misleading.

**2. "This page didn't load" when entering a room.**
Console + network confirm it's not a server error — it's:
```
TypeError: Importing a module script failed.
```
This happens when the browser has an old `index-*.js` cached and tries to `import()` a code-split chunk whose hash changed after the last deploy/HMR. The route boundary then renders the generic "This page didn't load" fallback. A hard refresh fixes it, but nothing in the app tells the user that or auto-recovers.

## Plan

### A. Give ratings real meaning on questions

1. **Schema**: add `content_rating text not null default 'pg13'` to `public.questions` with a CHECK in (`'pg'`,`'pg13'`,`'ma'`).
2. **Backfill** in the same migration:
   - `category = 'Adults Only'` → `'ma'`
   - `category in ('Kids')` → `'pg'`
   - everything else → `'pg13'` (current de-facto behavior — no regression).
3. **Filter in `game.functions.ts`** (`fetchPool` + the two other query sites at lines ~298, ~962, ~1277): translate host rating into an allow-list
   - PG → `content_rating = 'pg'`
   - PG-13 → `content_rating in ('pg','pg13')`
   - MA → all three, and only then allow `Adults Only`.
4. **Admin UI** (`admin-questions` if present, otherwise a follow-up): expose the rating field so we can hand-tune outliers later. Out of scope for this plan unless you want it now.

Note: this is the honest minimum. A real PG vs PG-13 split across ~6k existing questions would need an AI classification pass — happy to plan that as a separate credit-burn workstream if you want.

### B. Fix the "This page didn't load" import failure

1. **Auto-recover from stale-chunk errors** in `src/routes/__root.tsx` (and `join.tsx`'s `JoinRouteError`): when `error.message` matches `/Importing a module script failed|Failed to fetch dynamically imported module|ChunkLoadError/`, do a one-shot `location.reload()` guarded by a `sessionStorage` flag so we don't loop.
2. **Add a global `window.addEventListener('vite:preloadError', …)`** that reloads on preload failures (Vite's built-in signal for this exact case).
3. **User-visible copy**: when the auto-reload flag is already set (second failure in a row), show the existing fallback with a clearer "A new version was deployed — tap Refresh" message + Refresh button, instead of the current generic text.

### C. Verify

- Reload `/join`, enter code, confirm no error.
- Force a stale-chunk situation by editing a route and confirm the auto-reload kicks in once, not in a loop.
- Create a room with each rating, confirm the question pool query only returns rows matching the allow-list.

## Out of scope (ask if you want them added)
- AI-driven PG vs PG-13 reclassification of the 6k existing questions.
- Admin UI to bulk-edit `content_rating`.
- Any changes to voice pool / Sasha / announcer behavior — untouched.
