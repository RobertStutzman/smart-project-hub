## What's playing now

The "bing" you hear on elimination is the synth fallback in `sound-engine.ts` (`case "drop"` — a sawtooth sweep at line 217). There's already a `playRandomDrop()` bank of six MP3s (thud, glass, trapdoor, anvil, splash, electric), but on this preview it's falling back to the synth (either the mp3 assets aren't playing or they still sound cheap to you).

## Fix

Generate a fresh premium elimination SFX pack via the ElevenLabs Sound Effects API and swap it into the drop bank. Every drop plays a random pick, weighted, and never repeats twice in a row (existing logic — keep it).

New pack (8 cinematic clips, ~1.2–2.0s each):

1. **Sub thunk + tail** — deep sub-bass hit, room reverb tail.
2. **Bass drop + reverse riser** — punchy sub with reversed swoosh in.
3. **Glass shatter shard** — sharp break, no cartoon.
4. **Laser zap disintegrate** — sci-fi vaporize, quick.
5. **Anvil impact with metal ring** — heavy, film-trailer weight.
6. **Vault door slam** — thick metallic clank, gritty.
7. **Trapdoor whoosh + wooden crash** — cinematic fall.
8. **Electric zap + arc snap** — short tesla-coil pop.

## Implementation

1. **`src/lib/announcer.functions.ts`** — add `bakeEliminationSfxPack` server fn (mirrors the existing bake pattern):
   - Calls ElevenLabs `/v1/sound-generation` for each prompt (`duration_seconds: 1.8`, `prompt_influence: 0.55`).
   - Uploads each to the existing sounds Storage bucket under `sfx/drop-*.mp3`.
   - Upserts a `sounds` row per clip so the admin sounds table shows them.
   - Returns `{ ok, generated, skipped, errors }`.

2. **`src/routes/_authenticated/admin-sounds.tsx`** — add a **💥 Bake premium elimination SFX** button next to the existing bake buttons.

3. **`src/lib/sound-engine.ts`** — extend `DROP_BANK` to load the 8 new URLs (via `.asset.json` imports after they're baked and downloaded into `src/assets/audio/`, OR fetch dynamically from Storage on boot like other baked sounds do). Weight the new premium clips higher (weight 3) than the existing ones (drop to weight 1) so the good stuff plays most of the time. Keep the synth fallback only for muted/no-network cases.

4. **Remove the cheesy synth fallback**: change `case "drop"` in `sound-engine.ts` (line 216) to a short muted sub-thump instead of the sawtooth sweep, so even the fallback isn't a "bing".

## Technical notes

- No schema changes; reuses the existing `sounds` table and Storage bucket the other baked packs use.
- Credit burn is minimal (~8 short SFX gens) — good complement to the bigger vox bakes.
- ElevenLabs SFX API params: `text` (prompt), `duration_seconds`, `prompt_influence`. Uses the connector-synced `ELEVENLABS_API_KEY` already in use.
- Existing `playRandomDrop()` bank/weights/no-repeat logic stays; we're only adding entries and reweighting.