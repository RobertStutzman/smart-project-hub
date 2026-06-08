## Goal

Guarantee per-player sound variety: expand bank to **25 funny sounds** and replace the hash-based assignment with a **server-side, per-room no-repeat shuffle deck** stored on the player row, so the first 25 joiners in any room are all unique.

## Current state

- 10 sounds in `src/lib/funny-sounds.ts`.
- Assignment is `hash(session_id) mod 10` — global (same player gets same sound across rooms) and prone to collisions inside one room.
- Sound plays on join (player device), on tile drop (host stage), and on new-player detection (host stage).

## Changes

### 1. Generate 15 new SFX → 25 total

Use ElevenLabs SFX (already wired) to generate, then upload via `lovable-assets create` into `src/assets/audio/funny/`:

duckquack, goatscream, recordscratch, partyhorn, evillaugh, donkeybray, sneeze, burp, catmeow, dogbark, sheepbaa, wahwah, nooo, snore, vineboom

Each ~1.2–2.5s, prompt-engineered for clean isolated comedic effect.

### 2. `src/lib/funny-sounds.ts`

- Add imports + entries for the 15 new clips. `FUNNY_BANK` becomes length 25.
- Add `getFunnySoundById(id: string): FunnySound` (lookup by `id`, fallback to hash-mod for unknown ids — keeps host backward compatible while DB migrates).
- Add `playFunnySoundById(id: string, opts?)` analogous to existing `playFunnySoundForId`.
- Keep existing `getFunnySoundForId`/`playFunnySoundForId` (session-id hash) as the fallback path for any row missing `funny_sound_id`.

### 3. Database migration

```sql
ALTER TABLE public.players ADD COLUMN funny_sound_id text;
```
No GRANT changes needed (existing players grants cover it).

### 4. Server-side assignment in the join server function

In whatever `*.functions.ts` handles `joinFn` (locate by ref from `src/routes/join.tsx`):

- After upserting the player row, if `funny_sound_id` is null:
  1. Select existing `funny_sound_id`s for that `room_id`.
  2. Compute `remaining = FUNNY_BANK_IDS \ used`. If empty, `remaining = FUNNY_BANK_IDS` (reshuffle for player 26+).
  3. Pick a random id from `remaining`, `UPDATE players SET funny_sound_id = $1 WHERE id = $playerId`.
- Return the assigned `funnySoundId` from the server fn so the join screen can preview the exact clip.

The bank id list lives in a tiny shared module (`src/lib/funny-sound-ids.ts`) imported by both the server fn and the client bank — single source of truth, no client bundle bloat (just an array of strings).

### 5. Wire client to use stored id

- `src/routes/join.tsx`: use the `funnySoundId` returned from `joinFn` to call `playFunnySoundById(funnySoundId)` instead of `playFunnySoundForId(sid)`.
- `src/components/host/HostGameStage.tsx`:
  - Add `funny_sound_id: string | null` to the `Player` type and select list.
  - In the new-player join honk effect and the wrong-answer drop, prefer `p.funny_sound_id` and call `playFunnySoundById`; fall back to `playFunnySoundForId(session_id)` when null.

## Out of scope

- No changes to drop timing, debris, fall animation, mute UI, or SFX volume balancing.
- No retroactive backfill for existing rooms — old rows keep working via the hash fallback.

## Capacity summary after change

- **Bank:** 25 unique sounds.
- **Max simultaneous playback:** unlimited (one `<audio>` per clip in the pool; staggered 120ms per guilty player on a drop).
- **Uniqueness guarantee:** first 25 players in a room get distinct sounds; 26+ wraps via reshuffle.