## Goal

Add a distinct "busy lobby chatter" ambience (think ~100 people murmuring while waiting to enter a venue) that plays on the Landing, Join, and Host lobby screens — separate from the existing cheering crowd loop used mid-game.

## Approach

1. **Generate a new SFX clip** via ElevenLabs Sound Effects (22s, loopable) — prompt tuned for "large crowd of people talking in a busy venue lobby, indoor reverb, layered murmur, no music, no cheering". Save to `src/assets/audio/lobby-chatter.mp3` and externalize as a Lovable asset.

2. **Extend `src/lib/ambience-engine.ts`** with a new layer:
   - Add `startLobbyChatter()` / stop helper alongside the existing `crowd` / `drum` layers.
   - Low default target volume (~0.14) so it sits under voice/UI sounds.
   - Same fade + autoplay-rejection handling as the current layers.
   - Crossfade out when game music takes over (extend `climaxAndHandoff` to fade chatter too).

3. **Wire into the three screens** (silent gesture-gate per your preference):
   - **`src/routes/index.tsx`** — replace today's `startCrowd()` first-gesture hook with `startLobbyChatter()`. Also kick it off on the "Host on this screen" click so it carries into /host.
   - **`src/routes/join.tsx`** — add the same first-gesture starter so player phones get chatter while typing the code.
   - **`src/routes/host.tsx`** — in the lobby effect, start lobby chatter immediately and layer the cheering crowd + drumroll on top after a short delay (chatter stays underneath for venue feel). When game starts, `climaxAndHandoff` fades all three out.

4. **No game-phase impact.** Chatter only plays in the lobby. Once the game-show music swells in, chatter fades to 0 alongside crowd and drum.

## Files touched

- new: `src/assets/audio/lobby-chatter.mp3.asset.json` (via `lovable-assets create`)
- `src/lib/ambience-engine.ts` — new chatter layer, helpers, handoff fade
- `src/routes/index.tsx` — swap first-gesture starter to chatter; pre-arm on host click
- `src/routes/join.tsx` — add silent first-gesture chatter starter
- `src/routes/host.tsx` — start chatter alongside crowd+drum in lobby effect

## Out of scope

- New music or replacing the existing crowd/drum cheering loop
- Volume mixer UI / per-screen mute controls (not requested)
- Ambience on mid-game / leaderboard / recap screens
