## Round recap: add celebration music + smooth scrolling

### 1. Celebration music during the recap reel
`src/components/host/RoundRecapReel.tsx`
- On mount (per `triggerKey`), call `playCreditsMusic(0.18)` from `@/lib/sound-engine` to start the celebratory outro bed (same track Credits already uses, just quieter so persona voice lines sit on top).
- Do NOT stop it on unmount — if the recap rolls into Credits, the same track keeps playing seamlessly. If recap goes back to the lobby/next round, the existing `startMusic("lobby"|"tense")` in `HostGameStage` already calls `stopCreditsMusic` internally, so no extra cleanup needed.

`src/lib/sound-engine.ts`
- Tiny guard in `playCreditsMusic`: if `creditsAudio` is already playing the same `creditsOutro.url`, just update its target volume instead of stop+restart. Prevents the "blip" when CreditsStage runs `playCreditsMusic` 700 ms after mount on top of the recap-started instance.

### 2. Smooth scrolling between beats
`src/components/host/RoundRecapReel.tsx`
- Remove the SVG film-grain overlay (lines ~628-635). That noise layer is literally what reads as "grainy."
- Tone the sweeping light bar down (`via-amber-300/8`, slower) so it doesn't strobe.
- Unify every beat's enter/exit into a single soft crossfade + 12 px vertical drift (one shared `transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}`). Today some beats slide ±120 px on X with springs while others fade — that mismatch is what makes the cuts feel choppy.
- Switch `<AnimatePresence mode="wait">` → `mode="popLayout"` and wrap the stage in a relative container so outgoing and incoming beats can crossfade over the same frame instead of waiting for the exit to finish before the next one starts (kills the dead beat between cards).
- Bump each beat's `durationMs` floor to ≥ `enter (0.5s) + hold + exit (0.5s)` — current 1800 ms beats (splash, outro) get bumped to 2200 ms so the exit isn't clipped.
- Add `will-change: transform, opacity` to the motion containers so the browser promotes them to their own layer (smoother on lower-end devices).

### Out of scope
- No changes to which beats appear, copy, persona callouts, scoreboard data, Credits stage visuals, or HostGameStage scheduling.
- No new audio assets; reusing existing `credits_outro.mp3`.

### Technical notes
- `popLayout` is the right mode here because beats are absolutely centered in a grid cell — they don't reflow on swap, so we want overlap, not sequential.
- The volume of `playCreditsMusic(0.18)` is intentionally lower than Credits' own `0.22` so voice TTS during recap stays intelligible; ducking via `duckMusic()` (already wired in sound-engine) will still apply when callouts fire.
