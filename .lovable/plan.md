# Premium Broadcast Pass

After auditing the codebase, most of the big swings I pitched are already in. This plan **only fills genuine gaps** and **extends existing systems** rather than rebuilding them.

## Do NOT rebuild (already shipped, leaving alone)
- Host VO / ElevenLabs pipeline (`elf-voice.ts`, `persona-live.ts`, `round-callouts.ts`)
- Cold open boot sequence (`BootSequence.tsx`) + station ID
- "Tonight's contestants" roster reveal (`IntroStage.tsx`)
- Pre-show lobby chatter + crowd ambience (`ambience-engine.ts`, `use-lobby-chatter.ts`, `lobby-banter.ts`)
- Wager slow-reveal with row stagger + count-up (`FinalStages.tsx`, `useFinalRoundFx.ts`)
- Leaderboard layout-spring row swaps (`Leaderboard.tsx`)
- Shattered-face wrong-answer pop, Wildcard banner, Winner spotlight

## Build (in priority order)

### 1. Lower-third chyron overlay (mid-game) — NEW
A persistent broadcast-style overlay layer above the game stage that pops contextual call-outs in real time:
- "🔥 3-streak — Alice" / "⚡ Fastest finger" / "+450 → 2,310 pts"
- Slides in from bottom-left, 2.5s, animated underline accent, brand color
- New component `src/components/host/Chyron.tsx` + a tiny event bus in `src/lib/chyron-bus.ts`
- Subscribers: `HostGameStage` reveal callbacks, `Leaderboard` rank-change, `QuestionStage` lock-in
- Reuses existing streak / fastest / delta data already computed in `Leaderboard.tsx`

### 2. Animated category reveal card — NEW
Inserted into the existing 6s question intro phase (`QuestionStage.tsx:86-97`), before the question text appears:
- 1.2s card flip showing category icon + name (e.g., "🎬 MOVIES")
- Sting SFX (reuse `whoosh` + new short brass hit generated via ElevenLabs SFX)
- Plugs into the existing `ShutterTransition` timing — does not replace it

### 3. Achievement toast layer — NEW (unifies pops)
Single mid-game toast component for streaks, comebacks, perfect rounds, clutches:
- `src/components/host/AchievementToast.tsx`
- Triggers off existing `host-moments.ts` keys (`streak_hot`, `comeback`, `leader_changed`, `perfect_round`)
- **Coexists** with `ShatteredFaces` (wrong-answer) and `WildcardBanner` (round modifier) — those are stage-specific; toast is the general layer
- VO already speaks these moments via `persona-live.ts`; toast adds the visual

### 4. Adaptive timer-driven music escalation — EXTEND
Currently `startMusic("tense", tempoMs)` is a flat synth loop. Extend, don't replace:
- Add `setMusicIntensity(0..1)` to `sound-engine.ts` that ramps tempo + adds a low rumble layer as timer drops below 50% / 25% / 10%
- Hook into existing `QuestionStage` timer
- Final 3 seconds switch to `tickHeavy` (already exists) — keep that

### 5. Per-player walk-on stinger — EXTEND IntroStage roster
Add a short 0.6s audio sting per card reveal in `IntroStage.tsx:168-215`:
- 4-clip rotating bank (synth riser / brass hit / 8-bit bloop / vinyl scratch) so consecutive players sound distinct
- Generated once via ElevenLabs SFX, stored as `.asset.json` like `boot_sting.mp3`
- Volume ducked under VO if announcer is talking

### 6. Leaderboard rank-change flash — EXTEND
`Leaderboard.tsx` already animates row positions via Framer `layout`. Add:
- A 600ms glow flash on rows whose `rank` changed since last render
- Up-arrow / down-arrow micro-icon next to the delta badge
- No new component — ~20 lines in the existing row

### 7. Theme pack expansion — EXTEND stub
`theme.ts` defines `THEMES = ["fellowship"]` with full data-theme architecture ready. Add three packs:
- **vegas** — saturated reds/golds, neon shimmer particles, slot-machine SFX accents
- **noir** — desaturated, hard shadows, jazzy bed, smoke particle layer
- **retro** — CRT scanlines, magenta/cyan, chiptune accents
- Each adds: CSS var block in `styles.css`, particle config in `ThemeParticles.tsx`, optional music bed override
- Host can swap from `HostOnboarding`

### 8. Instant-replay graphic — NEW (small)
On comeback / dramatic answer flips, a 2s "▶ INSTANT REPLAY" lower-third + tape-rewind SFX, then the last reveal animation plays once more at 0.6× speed. Triggered manually by host hotkey + automatically on `leader_changed` after round 3+.

## Explicitly cutting (not worth it)
- **Commercial bumpers** — would interrupt pace; the round-recap reel already serves this role
- **50/50 / steal / skip lifelines** — would require game-logic + DB changes; current `Blind 2×` + `Glitch leader` already cover the power-up vibe. Bring back later as its own scoped request.
- **Lens flares & Ken Burns parallax** — high effort, easy to look cheesy; revisit only if user wants more visual flash after the above ships.

## Technical notes
- All new audio assets generated via ElevenLabs Music/SFX API, uploaded via `lovable-assets create`, referenced as `.asset.json`
- No DB / migration changes
- No new dependencies
- Files touched: `src/components/host/Chyron.tsx` (new), `Leaderboard.tsx`, `QuestionStage.tsx`, `IntroStage.tsx`, `sound-engine.ts`, `theme.ts`, `styles.css`, `ThemeParticles.tsx`, `HostGameStage.tsx`, plus ~4 new audio `.asset.json` files

## Suggested ship order
Phase A (visual polish, fastest): #1 Chyron, #2 Category card, #6 Rank flash
Phase B (audio depth): #4 Adaptive music, #5 Walk-on stingers
Phase C (drama): #3 Achievement toast, #8 Instant replay
Phase D (variety): #7 Theme packs

Want me to start with Phase A, or pick a different order?
