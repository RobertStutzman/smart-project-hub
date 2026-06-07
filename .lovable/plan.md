## Phase 1.6 — Pre-bake Vox catchphrases (kill ~80% of live ElevenLabs calls)

Bake the 30 static lines from `host-persona.ts` to Supabase Storage once. Client checks storage first, only hits ElevenLabs for truly dynamic lines (player-name roasts, intro/credits narration with rosters).

### What changes

**1. New server fn — `generatePersonaPack`** (in `src/lib/announcer.functions.ts`)
- Imports the `LINES` dict from `host-persona.ts` (10 moments × 3 lines = 30)
- For each line: generate TTS (hype preset, Elf voice) → upload to `question-media` bucket at `announcer/persona_<moment>_<idx>.mp3` → upsert `sound_clips` row with slot `Persona`, category `Persona`, label = the line text
- Admin-gated, idempotent (re-running re-uploads + replaces rows, same as `generateAnnouncerPack`)
- Returns `{ generated, errors, total }`

**2. New server fn — `getPersonaCacheMap`** (no admin gate)
- Returns `Record<text, publicUrl>` for all clips in the `Persona` category
- Cached on the client for the session via TanStack Query

**3. Client lookup — extend `src/lib/elf-voice.ts`**
- Add `initPersonaCache(map)` to seed an in-memory `text → url` lookup
- `speakAsElf(text)` checks the URL map first → plays from storage (free) → only falls back to `speakPersonaLine` server fn on miss
- HostGameStage calls `initPersonaCache` once on mount via `useQuery` over `getPersonaCacheMap`

**4. Admin UI button — `src/routes/_authenticated/admin-sounds.tsx`**
- Add "Generate persona pack" button next to the existing "Generate announcer pack" button
- Shows progress (X / 30), errors, and a "regenerate" option

### Files touched

```text
src/lib/announcer.functions.ts          # + generatePersonaPack, getPersonaCacheMap
src/lib/elf-voice.ts                    # + initPersonaCache, storage-first lookup
src/components/host/HostGameStage.tsx   # call initPersonaCache once on mount
src/routes/_authenticated/admin-sounds.tsx  # + button
```

No DB migration. Reuses existing `sound_clips` table, `Persona` category for filtering.

### Acceptance

- After clicking "Generate persona pack" once, every catchphrase ("Buckle up. The drop is coming.", "On fire!", etc.) plays from Supabase Storage — zero ElevenLabs calls during gameplay for static lines
- Dynamic lines (player-name roasts, narration with rosters) still use live TTS path
- Re-running the generator overwrites cleanly

### Cost impact

Drops live ElevenLabs usage from ~700 chars/game to ~100-150 chars/game (~80% reduction). Re-baking the 30 lines costs ~1500 chars total, one-time.

### Reminder

If usage scales past ~500 games/month, revisit **Phase 1.7**: server-side DB cache for dynamic lines (cuts another ~15%) + per-session rate limits as a circuit breaker.
