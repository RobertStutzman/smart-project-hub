## Premium boot intro: music + voice + pill polish

### What we'll hear

When someone hits droptrivia.app and taps the "press to play" pill:

1. **Pill press**: deep `thunk` + upward riser (~250ms)
2. **Music sting** kicks in: ~8s composed game-show bed, brassy/retro, crescendos into a final chord
3. **At ~1.2s** announcer voices the station ID: *"You're watching… Beat the Drop."* (ducked under music)
4. **Splash** wordmark lands on the music's peak chord (~3.0s)
5. **Credits** stage rides the bed's tail with a vinyl-crackle texture underneath
6. **Music fades** over 600ms as boot dismisses; landing page takes over with lobby chatter

### Generation

- **Music bed**: generate one `boot_sting.mp3` via ElevenLabs Music API (~9s, "retro 70s game show brass intro, crescendo, final big chord, premium broadcast bumper"). Save once, ship as a CDN asset.
- **Voice line**: generate one `boot_voice_id.mp3` via existing TTS pipeline (`elf-voice.ts` / persona "hype") at build time and save as a static asset — don't TTS on every visit.
- Both files go through `lovable-assets create` so they're served from CDN.

### Audio engine additions (`src/lib/sound-engine.ts`)

- Add `playBootMusic(volume)` / `stopBootMusic(fadeMs)` mirroring the existing `playCreditsMusic` pair.
- Add a tiny ducking helper: `duckMusic(targetVolume, durationMs)` so the voice ID can dip the music -8dB and recover. Scoped to the boot bus for now; full ducking bus comes in a later pass.

### Boot sequence (`src/components/BootSequence.tsx`)

- On gate press: play `thunk` + riser SFX → start `playBootMusic(0.32)` → schedule voice ID at +1200ms with auto-duck.
- Remove the inline `startLobbyChatter()` + `startCrowd()` ambience kick-off from boot (currently fighting the music). Landing page owns ambience once boot ends.
- Add subtle vinyl-crackle bed during credits stage at ~-22dB (reuse existing crowd-ambience asset at low gain, or skip if we want it tight).
- On boot dismiss: `stopBootMusic(600)` fade-out concurrent with the overlay exit.

### Pill smoothness fix

Root cause: framer-motion `animate={{ scale: [1, 1.06, 1] }}` with `repeat: Infinity` repaints the 60px shadow every frame.

- Move pulse to a CSS keyframe (`@keyframes pillPulse { 0%,100% { scale: 1 } 50% { scale: 1.045 } }`) in `src/styles.css`, applied via className, with `will-change: transform` and `translateZ(0)` to promote to its own layer.
- Reduce static shadow radius 60→40px so the compositor has less work.
- Keep the press-down feedback (scale 0.95 / 140ms) via a class toggle, not by swapping the framer animation prop mid-flight.

### Duplicate-intro cleanup

- Gate `useLobbyChatter()` in `src/routes/index.tsx` behind `!showBoot` so chatter doesn't start under the music.
- Audit other autoplay paths on the landing → press-to-play flow; nothing else competes today, but I'll confirm during implementation.

### Files touched

- `src/components/BootSequence.tsx` — music wiring, voice scheduling, ambience removal, pill className swap
- `src/lib/sound-engine.ts` — `playBootMusic` / `stopBootMusic` / `duckMusic`
- `src/styles.css` — `pillPulse` keyframe
- `src/routes/index.tsx` — gate `useLobbyChatter` on `!showBoot`
- `src/assets/audio/music/boot_sting.mp3.asset.json` (new, generated)
- `src/assets/audio/voice/boot_station_id.mp3.asset.json` (new, generated)

Game-stage intros (`IntroStage`, `CreditsStage`) are NOT touched — those are contextual, not the app intro.

Once you approve, I'll generate the audio assets and wire it all up so you can hear it in the preview.
