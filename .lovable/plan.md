# Phase 1 — Beat the Drop Trivia: Core Setup, Database & Connections

## Goal
Stand up the foundation: enable Lovable Cloud, create the schema, wire host/mobile views to a shared room over Realtime, and harden the connection (persistence, wake lock, host migration). No gameplay logic yet — that's Phase 2+.

## 1. Backend: Enable Lovable Cloud
- Enable Lovable Cloud (Supabase under the hood) for Postgres, Auth, Realtime, and scheduled jobs.
- Anonymous sign-in for players (no email required to join a room).

## 2. Database Schema (migration)

**`rooms`**
- `id` uuid PK, `room_code` text unique (4 uppercase letters), `status` text (`lobby` | `playing` | `paused` | `ended`)
- `current_category` text, `is_paused` boolean default false
- `host_session_id` text (for host migration detection)
- `created_at` timestamptz default now()

**`players`**
- `id` uuid PK, `room_id` uuid FK → rooms(id) on delete cascade
- `nickname` text, `session_id` text (matches localStorage), `avatar_url` text
- `score` int default 0, `is_audience` boolean default false, `streak_count` int default 0
- `last_seen_at` timestamptz, `created_at` timestamptz default now()
- Unique (`room_id`, `session_id`)

**`questions`**
- `id` uuid PK, `category` text, `subcategory` text
- `question_text` text, `correct_answer` text, `wrong_1/2/3` text
- `media_url` text, `media_type` text (`image` | `audio` | `video` | null)
- `is_premium` boolean default false

**RLS & GRANTs**
- Enable RLS on all tables. GRANT select/insert/update to `authenticated` and `anon` (rooms/players are public-by-code; questions are read-only public except premium gating in app logic).
- Policies: anyone can read rooms/players/questions; players can update/insert their own row by `session_id`; host can update its own room.
- Realtime publication enabled for `rooms` and `players`.

**Auto-cleanup**
- Enable `pg_cron` + `pg_net` extensions.
- Schedule hourly job: `DELETE FROM rooms WHERE created_at < now() - interval '24 hours'` (cascade removes players).

## 3. Frontend Routes (TanStack Start)
- `/` — landing: "Host a Game" (→ `/host`) and "Join a Game" (→ `/join`).
- `/host` — Host TV view: creates a room, displays 4-letter code + QR, player list.
- `/join` — Mobile entry: room code + nickname form.
- `/play` — Mobile Controller: shows current state, "Host disconnected" overlay when `is_paused`.

All four pages get unique `head()` metadata.

## 4. Persistence & Reconnect
- On join, generate `session_id` (uuid) and store `{ session_id, room_code, nickname }` in `localStorage` under `btd:player`.
- On `/play` mount: if localStorage entry exists, upsert into `players` by (`room_id`, `session_id`) and resume score/streak.
- Heartbeat: update `last_seen_at` every 15s via a server function.

## 5. Realtime Wiring
- Host subscribes to `players` (room scope) for live roster; subscribes to `rooms` for state.
- Mobile subscribes to `rooms` for category/pause changes.
- Single root `onAuthStateChange` listener invalidates queries on auth changes.

## 6. Wake Lock (Mobile Controller only)
- Native `navigator.wakeLock.request('screen')` on `/play` mount; re-acquire on `visibilitychange`. Fallback: `NoSleep.js` via `bun add nosleep.js` if API unavailable (older iOS).

## 7. Host Migration / Disconnect Detection
- Host emits heartbeat every 5s updating `rooms.host_last_seen_at`.
- Mobile clients watch: if `now - host_last_seen_at > 15s` OR `is_paused = true`, show full-screen "Host disconnected — waiting to resume…" overlay.
- A server function called from any returning host with the same `host_session_id` flips `is_paused` back to false.

## 8. Freemium Flag (scaffolding only)
- Add `profiles` table: `user_id` PK FK auth.users, `is_premium` boolean default false, `premium_until` timestamptz null.
- Auto-create profile via trigger on signup.
- Helper `useIsPremium()` hook reading current user profile.
- Category picker on `/host` shows lock icon on premium categories; clicking opens a placeholder paywall modal ("Coming in Phase 3"). No payment provider wired yet.

## 9. Seed Data
- Seed ~20 free questions across 2–3 general categories (Music, Movies, General Knowledge) so Phase 2 has data to play with. Premium categories left empty for now.

## Technical Notes
- Server functions in `src/lib/*.functions.ts`: `createRoom`, `joinRoom`, `heartbeatPlayer`, `heartbeatHost`, `resumeAsHost`.
- Use `requireSupabaseAuth` middleware; anonymous sessions still produce a `userId`.
- All Supabase writes happen server-side; clients only read via Realtime + initial query.
- Verify build after migration; confirm Realtime delivers a player insert end-to-end before closing Phase 1.

## Out of scope (later phases)
- Question playback, timers, scoring math, audience mode UX, leaderboards.
- Actual paywall/Stripe integration.
- Sound/video drop mechanics.

## Open question
Anonymous auth for players is the simplest path (no email required, just type a nickname). Confirm that's the desired flow, or do you want players to optionally sign in with Google to keep stats across rooms?