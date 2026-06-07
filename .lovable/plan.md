## Phase 1.8 — TTS Observability Dashboard

Verify the cost insurance from Phase 1.7 is actually working. Today we have `rooms.tts_calls_count` (per-game cumulative) and `tts_cache` (text → hits), but no time-series, no per-game cost, no cap-skip count. Add a thin event log and a dashboard.

### Data layer

New table `tts_call_log` — one row per `speakPersonaLine` invocation. Pure append-only audit.

```
id uuid pk
room_id uuid                        -- nullable (some calls happen outside a room)
preset text                         -- 'hype' | 'roast' | etc.
text_hash text
char_count int                      -- length of text input
outcome text                        -- 'cache_hit' | 'generated' | 'cap_skipped' | 'error'
created_at timestamptz default now()
```

Index `(created_at desc)` and `(room_id, created_at desc)`. RLS: deny all client access (admin server fn reads only via `supabaseAdmin`).

### Instrumentation

`src/lib/announcer.functions.ts` → `speakPersonaLine`: at the very end of each branch (cache hit, generated success, cap skip, error), insert a row into `tts_call_log` with the outcome. Best-effort — wrap in try/catch so a logging failure never breaks a voice line.

### Aggregation server fns (admin-only)

Add to `announcer.functions.ts`:

- `getTtsTimeSeries({ days: number })` → daily buckets for the last N days. Each bucket: `{ day, cache_hits, generated, cap_skipped, errors, total_chars_generated }`. Default 14 days.
- `getTtsTopGames({ days, limit })` → groups by `room_id` over last N days, returns `{ room_id, room_code, total_calls, generated, cache_hits, cap_skipped, generated_chars }` sorted by `generated_chars desc`. Join `rooms` to get `room_code`. Default 7 days, top 20.
- `getTtsSummary({ days })` → top-line numbers: total calls, cache hit rate %, cap-skip rate %, total generated chars, estimated cost (chars × $/1M from constant), avg calls/game.

Cost estimate constant: `TTS_COST_PER_MILLION_CHARS = 30` (ElevenLabs Starter rate ≈ $30/1M chars). Easy to tweak.

### Dashboard UI

New route: `src/routes/_authenticated/admin-tts.tsx` (auth-gated, admin-checked via existing `has_role` pattern used in admin-sounds).

Layout:

```text
┌─ Top stats (last 7d) ─────────────────────────────┐
│ Total calls │ Cache hit % │ Cap skips │ Est. cost │
├──────────────────────────────────────────────────┤
│ Cache hit rate trend (last 14 days)              │
│ [stacked bar chart: cache_hit / generated /      │
│  cap_skipped per day]                            │
├──────────────────────────────────────────────────┤
│ Top games by spend (last 7d)                     │
│ room_code │ total calls │ generated chars │ $    │
│ ABCD      │ 47/50       │ 12,400          │ $0.37│
│ ...                                              │
├──────────────────────────────────────────────────┤
│ Top cached lines (existing — pulled from         │
│ getTTSCacheStats)                                │
└──────────────────────────────────────────────────┘
```

Time-range selector at the top: 24h / 7d / 14d / 30d (drives all three sections).

Charts: simple inline SVG/divs (no new chart library). Stacked bar = three divs per day with widths proportional to counts. Keeps dependencies clean.

Link from `/admin-sounds` cache panel: small "Open observability dashboard →" anchor.

### Files

- `supabase migration` — create `tts_call_log` + grants + RLS
- `src/lib/announcer.functions.ts` — add log insert in `speakPersonaLine`; add `getTtsTimeSeries`, `getTtsTopGames`, `getTtsSummary`
- `src/routes/_authenticated/admin-tts.tsx` — new dashboard route
- `src/routes/_authenticated/admin-sounds.tsx` — add link to the new dashboard

### Acceptance

- Play a game with 3 dynamic roasts. `/admin-tts` 24h view shows 3 calls, 0 cache hits the first time, then 3 hits on a repeat game.
- Trigger the cap (set `TTS_CAP_PER_GAME=3` env, play, exceed) → cap_skipped count rises on the dashboard.
- Top games table lists the test rooms with their char totals and a dollar estimate.
- Cache hit rate chart renders correctly across 7 / 14 / 30 day ranges.
- No regression to `speakPersonaLine` — logging is best-effort.

### Out of scope

- ElevenLabs upstream usage reconciliation (their dashboard is the source of truth for actual billing)
- Alerts/notifications when cost crosses a threshold
- Per-host or per-user cost attribution