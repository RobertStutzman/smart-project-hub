## Goal
Replace the synth-generated timer tick (`tick` + `tickHeavy` in `sound-engine.ts`) with real audio clips generated via ElevenLabs Sound Effects, served as CDN assets.

## Scope
Only the timer tick. Wrong / correct / leaderboard sounds stay as-is.

`tick` fires once per second under the question timer; `tickHeavy` is the heavier heartbeat for the final question's last seconds.

## Steps

1. **Connector check.** Verify the ElevenLabs standard connector is linked. If not, prompt and link it.

2. **Generate two SFX once via ElevenLabs Sound Effects API:**
   - `tick.mp3` — ~0.3s. Prompt: *"Short warm wooden tock, single hit, dry, no reverb, percussive, 300ms, clean tail"*.
   - `tick-heavy.mp3` — ~0.5s. Prompt: *"Deep cinematic heartbeat thump, sub-bass with low wooden body, single hit, 500ms, dramatic, tense"*.
   - Use a short throwaway server script (one-off) to call the API and write the MP3s to `/tmp`, then upload via `lovable-assets create` → `src/assets/audio/tick.mp3.asset.json` and `tick-heavy.mp3.asset.json`. No persistent endpoint, no runtime cost per play.

3. **Wire into `src/lib/sound-engine.ts`:**
   - Import both `.asset.json` pointers alongside the other audio assets (~line 276–281).
   - Add a tiny pooled-playback helper for tick clips (reuse a single `HTMLAudioElement` per slot so firing every second doesn't churn GC or stagger on mobile).
   - In `playInner(sfx)`, for `case "tick"` and `case "tickHeavy"`, play the asset via the pool. On failure (autoplay block, decode error), fall back to the existing synth `sweep()` calls so nothing goes silent.
   - Respect `synthVolumeScale` so audience overlays still duck the tick the same way.

4. **Verify.** Build, then in preview confirm the question timer ticks with the new sound and the final-question last-5 heartbeat uses the heavy variant. No console errors. No regressions on other sounds.

## Technical notes
- ElevenLabs SFX API: `POST https://api.elevenlabs.io/v1/sound-generation` with `{ text, duration_seconds, prompt_influence: 0.4 }`, `xi-api-key` header. Returns raw MP3 bytes.
- Generation script is run-once from the sandbox; it does **not** ship in the app bundle. The committed artifacts are just the two `.asset.json` pointers.
- Pool pattern: `const pool = new Audio(url); pool.preload = "auto";` then on each play `pool.currentTime = 0; pool.play()`. One element per tick variant is enough at 1 Hz.
