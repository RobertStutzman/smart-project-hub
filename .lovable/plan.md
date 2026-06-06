# Premium Announcer + Lobby Music

Add a hype, fun host voice and an upbeat lobby loop to make Beat the Drop feel like a Jackbox show. All audio is generated **once** via ElevenLabs, stored in the `question-media` bucket, and replayed for free on every game.

## Voice choice
**Brian** (`nPczCjzI2devNBz1zQrb`) — deep, energetic hype-man. High style (0.7), low stability (0.35) so lines feel theatrical and game-show-y.

## Announcer script (pre-generated)
Saved as `sound_clips` rows with slot keys:

- `vo_welcome` — "Welcome… to BEAT THE DROP! The trivia showdown where only the fastest survive. Let's meet your players!"
- `vo_round_1` — "Round one. Fingers on buzzers."
- `vo_round_2` — "Round two. The heat is rising."
- `vo_round_3` — "Round three. No mercy now."
- `vo_final` — "This… is the FINAL DROP. Wager it all."
- `vo_lock_in` — "Lock it in!"
- `vo_time_up` — "Time's up!"
- `vo_correct_streak` — "On fire!"
- `vo_taunt_1` — "Oof. That's gonna leave a mark."
- `vo_taunt_2` — "Somebody call a doctor, that was painful."
- `vo_taunt_3` — "Yikes. Maybe trivia isn't your thing."
- `vo_game_over` — "And that's the drop! Let's see who survived."

## Lobby music
One ~30s loopable ElevenLabs Music track: *"Upbeat game show intro loop, playful retro synth, claps, anticipation, energetic, loopable, instrumental."* Assigned to the `lobby_music` slot with `loop=true`, `volume=0.5`.

## Implementation

### 1. Server function `generateAnnouncerPack` (admin-only)
`src/lib/announcer.functions.ts` — one click runs the whole pipeline:
- For each script line: call ElevenLabs TTS (Brian, style 0.7, stability 0.35, `eleven_multilingual_v2`) → upload MP3 to `question-media/announcer/{slot}.mp3` via `supabaseAdmin` → upsert `sound_clips` row (`is_active=true`, `volume=0.85`, category `announcer`).
- Call ElevenLabs Music API for the lobby loop → upload to `question-media/announcer/lobby_loop.mp3` → upsert into `lobby_music` slot.
- Guarded by `requireSupabaseAuth` + `has_role(uid, 'admin')` check.

### 2. Admin UI button
Add "Generate announcer pack" button on the Admin page (in the existing Sounds section). Shows progress, disables while running. Re-runnable if you tweak the script.

### 3. Trigger playback in game flow
Wire to existing `sound-engine.ts`:
- **Lobby music**: already plays via `startMusic("lobby")` — just point the slot at the new file.
- **`vo_welcome`**: in `src/routes/host.tsx`, play once on first mount of lobby (with lobby music ducked to ~0.2 during VO, restored after).
- **Round intros**: in game phase transitions, play `vo_round_{N}` when round number increments; `vo_final` on the last round.
- **`vo_lock_in`**: play when timer hits the last 3 seconds.
- **`vo_time_up`**: play on reveal phase.
- **Taunts**: 30% chance to play a random `vo_taunt_*` after reveal when ≥1 player got it wrong.
- **`vo_game_over`**: play on final scoreboard.

### 4. Ducking helper
Small addition to `sound-engine.ts`: `playVoiceOver(slot)` that drops music volume to 0.2, plays the VO, restores to original on `ended`.

## Cost
- One-time generation: ~13 short TTS lines + 1 music track ≈ pennies on your ElevenLabs account (uses the existing connector, not Lovable credits).
- Per game: $0. Files stream from your Cloud storage.
- Re-clicking "Generate announcer pack" re-bills the same small amount.

## Files touched
- New: `src/lib/announcer.functions.ts`, `src/lib/announcer.server.ts` (script constants + ElevenLabs helpers)
- Edited: `src/routes/admin.tsx` (add button), `src/lib/sound-engine.ts` (add `playVoiceOver` + duck), `src/routes/host.tsx` and game phase code (trigger VO events)
- DB: no schema changes — uses existing `sound_clips` table
