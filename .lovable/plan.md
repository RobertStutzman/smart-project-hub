## Capacity Health Widget on `/admin`

Add a live status card at the top of the admin page that tells you, at a glance, how close you are to maxing out the current Cloud plan.

### What it shows

A single card with four metrics, each with a 🟢/🟡/🔴 dot and a "% of estimated ceiling" bar:

1. **Active lobbies** — count of `rooms` in `lobby` / `in_progress` states updated in the last 10 min
2. **Live players** — count of `players` joined to those active rooms
3. **DB connections** — from `supabase--db_health` (used / max)
4. **DB size & WAL** — from `supabase--db_health`

Thresholds (matches what we discussed):
- 🟢 under 40% of ceiling
- 🟡 40–70% — plan upgrade
- 🔴 70%+ — upgrade now

Estimated ceilings for the current Cloud tier are hardcoded constants at the top of the widget (easy to bump later): `MAX_LOBBIES = 200`, `MAX_PLAYERS = 1600`, `MAX_CONNECTIONS` comes from db_health directly. We can tune those after you do a load test.

Auto-refreshes every 30s via TanStack Query. Manual "Refresh" button too.

### Files

- **New** `src/lib/health.functions.ts` — one `createServerFn` (`getCapacityHealth`) gated by `requireSupabaseAuth` + admin role check. Internally:
  - counts active rooms/players via `supabaseAdmin`
  - calls the same data source `supabase--db_health` exposes (Supabase project API). For v1 we'll just return the room/player counts plus a `connections` field populated from `pg_stat_activity` via `supabaseAdmin.rpc` — simpler than wiring the management API. (If you'd rather pull straight from `db_health`, I can swap that in.)
- **New** `src/components/admin/CapacityWidget.tsx` — presentational card, uses `useQuery({ refetchInterval: 30_000 })`.
- **Edit** `src/routes/_authenticated/admin.tsx` — render `<CapacityWidget />` right under the header (around line 262), above the existing tools.

### Out of scope (per your call)

- No email alerts
- No domain setup
- No persisted history / charts — just current snapshot

### One open question

For the connection count, do you want me to:
- (a) pull it from `pg_stat_activity` via a small SQL helper (no extra setup, slightly approximate), or
- (b) skip connections for now and just show lobbies + players + DB size (the two numbers you actually control day-to-day)?

I'd lean (b) — simpler, and connections aren't your bottleneck until you're already in trouble on the other two. Let me know which you want and I'll build it.