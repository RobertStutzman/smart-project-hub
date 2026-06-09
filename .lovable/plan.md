## Goal

Resolve every finding from the latest security scan so players cannot cheat by reading correct answers, and tighten storage/realtime/function exposure.

## Changes

### 1. Hide quiz answers (`questions` table)
- Drop the public `questions_select_all` policy.
- Keep admin SELECT only. All gameplay already reads `questions` via server functions using `supabaseAdmin`, so no client code breaks.

### 2. Stop polling-cheat on `rooms.current_correct_index`
- Add new column `rooms.revealed_correct_index INTEGER NULL`.
- Server functions that currently set `current_correct_index` at question start keep doing so (server needs it for scoring) — but `revealed_correct_index` stays NULL until the reveal phase, when the server copies the value over.
- Replace public SELECT on `rooms` with a policy that exposes a safe set of columns via a view-style approach: simplest reliable route is a Postgres VIEW `public.rooms_public` that excludes `current_correct_index` (and other host-only fields like `host_session_id`, `saboteur_session_id`, `tts_*`, `roast_candidates`) but includes `revealed_correct_index`. Lock the base `rooms` table SELECT to admin + service_role only.
- Update `src/routes/play.tsx`, `src/components/host/HostGameStage.tsx` (player-side reads), `src/routes/results.$roomId.tsx`, `src/routes/audience.tsx`, and `src/routes/dev.tsx` to read from `rooms_public` and use `revealed_correct_index` for the green-check display. Host-side reads keep using `rooms` via server fns.
- Update realtime: add the view's underlying table to publication coverage so postgres_changes still work, or switch the client subscription to listen on `rooms` filtered server-side. Simpler: keep realtime on `rooms`, but the public payload only contains the safe columns because RLS will filter out the row entirely for non-admin clients — so move the client to read via a server fn `getRoomPublicState` polled on each realtime tick. We will use the view-based approach (simpler and keeps current realtime behavior intact via `rooms_public`).

### 3. Lock `room_questions`
- Drop public SELECT, keep admin/service-role access only. Only server fns touch it today.

### 4. Avatars bucket hardening
- Drop `avatars_anon_insert`, `avatars_anon_update`, `avatars_public_read`.
- New INSERT policy: path must match `{roomCode}/*` AND filename must start with the caller's `sessionId-` prefix. Because uploads are anonymous, enforce path shape only (`name ~ '^[A-Z]{4}/[A-Za-z0-9-]+-\d+\.(jpg|jpeg|png|webp)$'`) and add a per-file size cap via bucket settings.
- Remove the broad UPDATE policy entirely (uploads are write-once with timestamped filenames).
- Narrow SELECT to objects matching the same path pattern (prevents bucket listing while keeping direct public URLs working).

### 5. Realtime channel authorization
- Add a default-deny RLS policy on `realtime.messages` for broadcast/presence topics. The app only uses `postgres_changes` (table replication), which is governed by table RLS, so denying broadcast/presence is safe.

### 6. SECURITY DEFINER function exposure
- `REVOKE EXECUTE ... FROM anon, authenticated` on `public.list_question_categories` and on `public.has_role`. `has_role` is still callable from RLS policies because RLS evaluates as table owner. The server fn `listCategories` will call the function via `supabaseAdmin` (service_role retains EXECUTE).

### 7. Extension in public schema
- Move whichever extension is in `public` (likely `pg_trgm` or similar) to the `extensions` schema with `ALTER EXTENSION ... SET SCHEMA extensions`.

### 8. Public bucket listing
- Covered by #4 (narrowed avatars SELECT policy).

## Technical Notes

- All DB changes ship in one migration. Code edits land right after migration approval so the regenerated `types.ts` includes the new view and column.
- Files expected to change:
  - `src/routes/play.tsx` — switch room read to `rooms_public`, swap `current_correct_index` → `revealed_correct_index`.
  - `src/routes/audience.tsx`, `src/routes/results.$roomId.tsx`, `src/routes/dev.tsx` — same swap.
  - `src/components/host/HostGameStage.tsx` — host realtime subscription stays on `rooms` via server fn (host has `host_session_id`, already gated server-side); read of `current_correct_index` unchanged on host stage.
  - `src/lib/game.functions.ts` — at reveal-phase transitions, also `UPDATE rooms SET revealed_correct_index = current_correct_index`. At question-start, `revealed_correct_index = NULL`.
  - `src/lib/rooms.functions.ts` — `listCategories` already uses `supabaseAdmin`, no change.
- After migration runs, types regenerate; only then make the code edits.

## Out of scope

- No UI redesign, no copy changes, no gameplay flow changes beyond hiding the answer until reveal.
- Existing avatar files that don't match the new path pattern will become inaccessible via list — direct URLs still resolve. The nightly cleanup job already prunes old files.
