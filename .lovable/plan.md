## Goal

When a wrong answer is eliminated mid-question, make the tile physically fall off the board (with debris/whoosh) and play one of several premium "drop" sound effects chosen at random — instead of the current static slash-and-stamp overlay.

## What changes visually

The `dropped` tile in `QuestionStage.tsx` currently stays in place with a faded card, a SVG slash, and the "OUT" stamp. New behavior:

1. The card tilts ~10–15°, briefly hangs, then drops off-screen on the Y axis with gravity easing (~700ms, fades out as it falls).
2. As it leaves, a quick debris/shatter burst (existing ember particles, plus a few rectangular shards) explodes from its centroid.
3. A faded "ghost" footprint (dimmed letter + label, no slash) remains in the original grid cell so the 2×2 layout stays stable and avatars/lock counts still show.
4. The "OUT" stamp + diagonal slash are removed — the drop is now the elimination beat.

Implementation: replace the inner `motion.div` animate values for the dropped state with a falling keyframe (`rotate`, `y: '120%'`, `opacity: 0`), gated by `dropped`. Move the ember burst out of `ShatterOverlay` into a one-shot `DropDebris` overlay that fires the moment `dropped` flips true. Render a separate static ghost cell underneath so the grid never reflows.

## What changes audibly

Add a small **drop sound bank** with 5–6 varied premium SFX generated via ElevenLabs and committed as static CDN assets:

- `drop-thud.mp3` — heavy wooden thud + low boom
- `drop-glass.mp3` — glass shatter on stone floor
- `drop-trapdoor.mp3` — wooden trapdoor creak + thud below
- `drop-anvil.mp3` — cartoon anvil whistle + clang
- `drop-splash.mp3` — comedic water splash with bubble
- `drop-electric.mp3` — short electric zap + sizzle

Wired through a new `playRandomDrop()` in `sound-engine.ts` that:
- Picks a random clip from the bank, weighted so cartoon ones (anvil, splash) appear less often than the serious ones.
- Avoids repeating the same clip twice in a row within one question.
- Falls back to the existing synth `play("drop")` if assets fail to load.

In `HostGameStage.tsx` line 332, replace `play("drop")` with `playRandomDrop()`.

## Files touched

- new assets: `src/assets/audio/drop-thud.mp3.asset.json`, `drop-glass.mp3.asset.json`, `drop-trapdoor.mp3.asset.json`, `drop-anvil.mp3.asset.json`, `drop-splash.mp3.asset.json`, `drop-electric.mp3.asset.json` (generated via ElevenLabs SFX, uploaded via lovable-assets CLI)
- edited: `src/lib/sound-engine.ts` — add `playRandomDrop()` with the bank, weights, anti-repeat memory
- edited: `src/components/host/QuestionStage.tsx` — replace `ShatterOverlay` with `DropFall` animation on the card itself + `DropDebris` particle burst + static ghost cell behind; remove slash and OUT stamp
- edited: `src/components/host/HostGameStage.tsx` line 332 — swap `play("drop")` for `playRandomDrop()`

## Out of scope

- No changes to scoring, server `dropWrongAnswer` logic, or player-side answer grid (mobile players already get their own `AnswerGrid` dropped state).
- TwitchPanel and final-round stages unchanged.
- The admin soundboard upload flow is untouched; these are baked-in defaults, not user-overridable events (we can promote them to user-overridable later if desired).
