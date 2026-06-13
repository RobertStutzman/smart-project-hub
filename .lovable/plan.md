# Beef up the boot intro

Goal: the first launch should feel like a movie-trailer cold open, not a quiet placeholder. Louder music, real voiceover, crowd energy, and a visual punch on the drop.

## What changes

### Audio
- **Boot music**: bump `playBootMusic` default volume from `0.34` → `0.78`. Add a small fade-in (300ms) so it doesn't clip in.
- **Crowd cheer layer**: at the moment the logo punches in (~t=2.2s), play a short crowd cheer/applause SFX layered under the music at ~0.55 volume, fading out over ~2s. Reuse `crowd_clap` from `src/assets/audio/audience/`.
- **Announcer rewrite (movie trailer tone)**: replace the single "Beat. The. Drop." with a 3-beat sequence read by The Elf, queued (not interrupted), with deliberate pauses between beats:
  1. (t≈1.0s) `"In a world… of bad answers…"`
  2. (t≈3.4s) `"…and faster fingers…"`
  3. (t≈5.4s) `"Beat. The. Drop."`
  Voice volume stays at 1.0 (already loud). Music ducks ~30% under each VO line via the existing voice→duck hook.

### Visuals
- **Logo punch-in**: when beat #3 ("Beat. The. Drop.") fires, kick a 220ms scale punch on the wordmark (`1.0 → 1.08 → 1.0`) plus a quick white screen flash (opacity 0 → 0.35 → 0 over 280ms).
- **Brighter rim glow**: bump the splash's center radial glow strength so the logo sits in a hotter pool of light during the punch.
- **Stage timing**: stretch the `splash` stage from `3400ms` → `6200ms` so all three VO beats land before the credits stage takes over. `credits` stays at `5200ms`.

### Files touched
- `src/components/BootSequence.tsx` — rewrite `startBootIntroAudio` (3-line trailer sequence + crowd layer), bump music volume, add punch/flash animation state on `SplashStage`, extend `splash` duration.
- `src/lib/sound-engine.ts` — raise default boot music volume to `0.78` and add a short fade-in to `playBootMusic`.

## Verification
1. Hard refresh `/`, tap the gate → music kicks in noticeably louder, crowd cheers swell under the logo.
2. The Elf reads all 3 lines with movie-trailer pacing, ducking the music each time.
3. On the third line, the logo punches and a quick white flash hits.
4. Skipping with a keypress still works and kills the audio cleanly (no orphan VO lines after dismiss — `cancelElfSpeech` runs on dismiss).
