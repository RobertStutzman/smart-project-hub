## Phase 1.7 — Cost insurance for dynamic ElevenLabs lines

Phase 1.6 killed the 30 static catchphrases. Phase 1.7 protects the **dynamic** path (player-name roasts, intro/credits narration, anything passed through `speakPersonaLine`) so the same exact line never bills twice and a runaway game can't drain your ElevenLabs quota.

### Two protections

**1. Server-side TTS cache** — every generated line is uploaded to storage and recorded in a `tts_cache` table keyed by `sha256(preset + text)`. Repeats return the cached URL for free. Player rosters and recurring roast templates repeat far more than you'd think — expect ~30-50% hit rate after a few games, ~70%+ once you have regulars.

**2. Per-game call cap** — a small counter on the `rooms` table (`tts_calls_count`). When a host starts a new game the counter resets. `speakPersonaLine` increments before generating; if it crosses the cap (default **50 calls / game**, configurable), the server returns `{ skipped: true, reason: "cap" }` and the client silently no-ops. Static catchphrases from Phase 1.6 don't count against the cap — they never hit the server.

### What changes

**Migration**
```text
tts_cache table:
  text_hash text PK
  preset text
  text text
  storage_path text
  created_at timestamptz
  last_used_at timestamptz
  hit_count int

rooms.tts_calls_count int default 0
rooms.tts_cap_started_at timestamptz
```
GRANTs: `service_role` only (writes happen via `supabaseAdmin` in server fns; clients never touch it directly).

**`src/lib/announcer.functions.ts` — rewrite `speakPersonaLine`**
- Hash input → `SELECT storage_path FROM tts_cache WHERE text_hash = ?`
- On hit: bump `hit_count` + `last_used_at`, return `{ audioUrl: signedUrl }`
- On miss: check + atomically increment `rooms.tts_calls_count` for the active room. If over cap (read from a new `TTS_CAP_PER_GAME` env var, default 50), return `{ skipped: true, reason: "cap" }`
- Otherwise: generate via ElevenLabs → upload to `question-media/tts-cache/<hash>.mp3` → insert `tts_cache` row → return `{ audioUrl: signedUrl }`
- Input now also accepts optional `roomId` so the cap counter knows which game to charge

**`src/lib/elf-voice.ts`**
- `fetchAudio` now expects `{ audioUrl?, audioBase64?, skipped? }` and prefers URL playback (lighter, browser-streamable)
- On `skipped: true`, silently resolve — no error, no crash. Game keeps playing
- Pass `roomId` through `speakAsElf(text, { preset, roomId })`; callers in `HostGameStage.tsx` thread it from the room state

**`src/lib/rooms.functions.ts`** (or wherever a game starts)
- When `phase` transitions from `lobby` → first round, reset `tts_calls_count = 0`, `tts_cap_started_at = now()`

**`src/routes/_authenticated/admin-sounds.tsx`** — small stats panel
- Total cached lines + total storage used
- Top 10 most-hit cached lines (sanity-check the cache is working)
- Current `TTS_CAP_PER_GAME` value + note on how to change it via secrets

**New secret (optional, default 50)**
- `TTS_CAP_PER_GAME` — number of live ElevenLabs calls allowed per game before the circuit breaker trips

### Files touched
```text
supabase migration                            # tts_cache table, rooms columns
src/lib/announcer.functions.ts                # cache + cap in speakPersonaLine
src/lib/elf-voice.ts                          # URL playback, skipped no-op, roomId pass-through
src/lib/rooms.functions.ts                    # reset counter on game start
src/components/host/HostGameStage.tsx         # pass roomId to speakAsElf calls
src/routes/_authenticated/admin-sounds.tsx    # cache stats panel
```

### Acceptance
- Two different games where Player "Alex" answers wrong → second game's roast for Alex plays from cache, zero ElevenLabs call
- Force 51 calls in one game → call #51 returns `skipped`, host UI keeps moving, no errors in console
- Admin page shows cache row count growing over time, with hit counts > 1 on common lines
- Phase 1.6 static catchphrases are unaffected (they never reach the server)

### Cost impact
- ~70% additional reduction on the dynamic path after a few sessions
- Hard ceiling per game prevents any single chaotic session from costing more than ~50 lines worth of characters
- Combined with Phase 1.6, you go from ~700 chars/game baseline → ~100 chars/game typical → max ~600 chars/game worst case (capped)

### One heads-up
Per-game cap uses the `rooms.tts_calls_count` column as the counter. That's a soft limit — two simultaneous requests could both squeak through if they read the counter at the same millisecond. For this use case (one host driving the game) that's fine. If you ever go multi-host-per-room I'd revisit with a proper atomic RPC.
