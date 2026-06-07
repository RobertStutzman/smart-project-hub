## Goal

Replace the silent opening with layered, high-quality ambience that builds anticipation from landing → host lobby → game start, then hands off to the existing game-show music.

## Audio assets (generated via ElevenLabs SFX)

Generate three new MP3 assets once and commit them to `src/assets/audio/`:

1. `crowd-ambience.mp3` — 20s loop. Murmuring TV-game-show studio audience, warm, distant, no claps. Plays loud enough to feel alive but never masks UI.
2. `drumroll-build.mp3` — 12s. Soft snare roll that crescendos, with a tom hit on the last beat. Designed to loop seamlessly until the game starts, then resolve.
3. `cymbal-swell.mp3` — 2s. Cymbal swell + impact hit for the handoff into game-show music.

These are static assets — no runtime ElevenLabs call. If a future user wants to swap them, they can use the existing soundboard upload flow.

## Where each layer plays

```text
/  (landing page)
  └── crowd ambience starts on first user interaction
      (autoplay needs a gesture — fade in on first click/scroll/keypress)

/host  (lobby, room code visible, players joining)
  └── crowd ambience continues (cross-route persistence via singleton)
  └── drumroll-build layer fades in, looping underneath

Host clicks "Start game" → IntroStage
  └── drumroll climax + cymbal-swell stinger
  └── crowd ambience fades out
  └── existing startMusic("lobby") / game-show track takes over (unchanged)
```

## Implementation

### 1. `src/lib/ambience-engine.ts` (new)

Small singleton that survives route changes (sits outside React tree, imported by both routes). Exposes:

- `startCrowd()` — lazy-creates an `HTMLAudioElement` for crowd-ambience.mp3, loops, fades in to ~0.18 volume. No-op if already playing or if `setMuted(true)`.
- `startDrumroll()` — adds drumroll-build.mp3 layered on top, loops, fades in to ~0.22.
- `climaxAndHandoff()` — plays cymbal-swell, fades crowd + drumroll to 0 over ~600ms, then stops them.
- `stopAll()` — hard stop (used on unmount of host flow / mute toggle).

Respects the existing `setMuted` state from `sound-engine.ts` by reading a shared mute flag (export a getter from sound-engine).

### 2. `src/routes/index.tsx`

- On mount, attach a one-time `pointerdown`/`keydown` listener that calls `startCrowd()` then removes itself (browser autoplay policy).
- Add a small muted/unmuted toggle in the corner so users can silence it. Persists in `localStorage` under the same key the host page uses (`bd_muted`) so the state carries across.

### 3. `src/routes/host.tsx`

In the existing effect at line 300-329:

- Before `startMusic("lobby", 600)`, call `startCrowd()` (idempotent — no-op if landing already started it) and `startDrumroll()`.
- Do NOT start the existing lobby music yet — defer it until the host clicks Start.
- When the host transitions to `IntroStage` (the existing "begin game" handler in `host.tsx` / `HostGameStage.tsx`), call `ambience.climaxAndHandoff()` and then `startMusic("lobby", 600)` as today. The existing welcome clip stays in place but plays alongside crowd instead of in silence.

### 4. `src/components/host/IntroStage.tsx`

No structural change. The cymbal swell from step 3 lines up with the title card fade-in. Optionally add a 200ms delay before `play("whoosh")` so the cymbal lands first.

### 5. Mute integration

Extend `setMuted` in `sound-engine.ts` to also call `ambience.stopAll()`. The existing mute button in host.tsx then silences everything in one place.

## Out of scope

- No changes to host persona TTS, shutter transitions, or the existing game-show music.
- No changes to the soundboard admin page; new files are static assets, not user-uploadable events.
- No changes to player/audience routes — ambience is host-TV only (plus landing page).

## Files touched

- new: `src/lib/ambience-engine.ts`
- new: `src/assets/audio/crowd-ambience.mp3`, `drumroll-build.mp3`, `cymbal-swell.mp3`
- edited: `src/routes/index.tsx` (gesture-gated crowd start + mute toggle)
- edited: `src/routes/host.tsx` (layer crowd + drumroll in lobby, climax on game start)
- edited: `src/lib/sound-engine.ts` (mute hook into ambience)
