## Jackbox-style credits + outro music

### 1. Game-show credits music
- Generate ~60s loopable orchestral/big-band outro via ElevenLabs Music (prompt: triumphant game-show outro, brassy, upbeat, cinematic).
- Upload as `src/assets/audio/music/credits_outro.mp3.asset.json`.
- Add `credits_music` event to `sound-engine.ts` (loop, volume 0.32, ducks for Vox).
- `CreditsStage` mount → `startCreditsMusic()`; unmount → fade-out 800ms.

### 2. Roastable "Funniest Moments" reel
Expand `deriveMoments` from 4 fixed badges to a richer pool the host calls out one-by-one with persona Vox lines:

| Award | Trigger | Roast tone |
|---|---|---|
| Tonight's Champion | top score | hype |
| Brain of the Night | most correct | hype |
| Fastest Finger | most first-locks | hype |
| Longest Streak | best_streak ≥ 3 | hype |
| Most Confident Wrong | wrong_count ≥ 2 | roast |
| Wooden Spoon | lowest non-zero score | roast |
| Buzzer Beater | most last-to-lock | jab |
| Goose Egg Collector | most zero-score rounds | jab |
| Big Spender | wagered everything on Final | hype/roast based on outcome |
| Heartbreaker | lost #1 spot on final question | sympathy roast |
| Audience MVP | top SFX-presser (if audience tracked) | jab |

Each award becomes a "Polaroid card" in the scrolling column: avatar + label + roast detail + decorative tape/border. Cards stagger-fade as they enter view.

### 3. Vox roast pass during scroll
- New `credits_award` moment in `persona-live.ts` with 8-10 templates per award type.
- `CreditsStage` schedules `speakAboutPlayer({ moment: "credits_award_<type>", ... })` for ~4-6 awards across the 32s scroll (paced ~4s apart) using the existing queued voice system so they never overlap.
- Cap roast count per game to keep within Tier 1 (existing call counter already enforces this).

### 4. Visual polish
- Add subtle marquee lights border around the credits panel.
- Animated film-reel sprockets along left/right edges.
- Confetti burst when winner card scrolls into the center.
- Producer/Cast/Funniest section dividers get art-deco flourishes.

### 5. Skip / Play Again
- Keep "Play again" CTA. Add small "Skip credits ⏭" link top-right that fades music + advances.

### Technical notes
- Music: ElevenLabs Music endpoint, 60s, mp3_44100_128. Use existing `lovable-assets` upload flow.
- Award computation requires stats already on `players` (`best_streak`, `fastest_count`, `correct_count`, `wrong_count`). New fields needed for Buzzer Beater (`last_lock_count`), Goose Egg (`zero_round_count`), Big Spender (`final_wager`, `final_won`), Heartbreaker (rank change on final). If those columns don't exist yet, gracefully omit those awards (no DB migration in scope unless you say otherwise).
- All Vox uses existing `speakAboutPlayer` queue → no overlap with music ducking.

### Out of scope
- DB schema changes for the missing stat columns (will surface as "skipped — needs columns X, Y" in the summary if missing).
- Per-player photo highlights (no selfie capture in pipeline yet).
