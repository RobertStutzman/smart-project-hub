## Phase 2 — Polish the Final Drop

Make the Final round feel like the climactic moment. Three beats: **wager (tension)**, **question (heart-pound)**, **reveal (drama)**. All work stays in `HostGameStage.tsx` + sounds; no game-logic changes.

### Beat 1 — Wager phase (tension build)

Current: split layout, "All players are betting…", locked counter. Static.

Add:
- **Heartbeat pulse**: amber glow on the page ring synced to a ~70bpm pulse (CSS keyframe). Pulse speed increases as more players lock in.
- **Animated bet counter**: locked / total morphs with `scale-in` each time someone locks. Add a soft "thud" sound on each lock (reuse `drop` sfx).
- **Top-3 standings**: subtle parallax — each row drifts in from left with stagger (`fade-in` + translateX, 80ms stagger).
- **"All in" warning ribbon**: if a top-3 player wagers their full score, show a small flashing "ALL IN — {name}" tag at top center.
- **Looping low-bass bed**: trigger `final` sound event (already exists) at phase entry, loop=true, volume 0.3. Stop on phase exit.

### Beat 2 — Final question (heart-pound)

Current: standard QuestionStage with amber ring + "★ Final question" badge.

Add:
- **Stronger ring**: ring pulses red→amber as timer drops below 10s, then below 5s flashes faster.
- **Vignette closes in**: radial darken from edges intensifies as time runs out (opacity tied to remaining %).
- **Tick sound speedup**: existing tick at 10s, then double-tick under 5s (reuse `tick` clip, faster interval).
- **Per-player lock-in flashes**: when a player locks an answer, brief amber flash overlay on their tile (already tracked via `current_answer_locked_at`).

### Beat 3 — Reveal (drama swell)

Current: shows correct answer, lists ranked players with delta.

Add:
- **Two-stage reveal**:
  1. **Pause beat** (~1.2s): "The answer was…" appears, big amber bar fills left→right while a rising sweep plays (reuse `whoosh`).
  2. **Answer slam**: correct answer text scales in from 0.5 with a heavy "boom" (reuse `reveal` sound event, or `drop` louder).
- **Per-player roll-out**: ranked list reveals one player at a time, bottom→top, 400ms stagger. Each row:
  - Correct → green flash + `correct` sfx (soft, volume 0.4)
  - Wrong + wager > 0 → red shake + `wrong` sfx (soft)
  - No bet → muted slide in, no sound
- **Score counter animation**: delta number counts up/down from previous score to new (300ms tween) instead of static print.
- **Winner crown**: after all rows revealed, if leader changed, the new #1 row gets a gold crown badge with a small `victory` cue (volume 0.5, no loop).

### Technical implementation

Keep everything client-side in `HostGameStage.tsx`. New helpers:
- `useStaggeredReveal(items, delayMs)` — returns indices that have "appeared", drives the roll-out.
- `useCountUp(from, to, durMs)` — tween hook for score deltas.
- `useHeartbeat(bpm)` — returns 0→1 pulse value for the wager ring.

Sound triggers reuse existing `play()` from the sounds system. The looping `final` bed during wager needs a small addition to the play helper to support `loop: true` and explicit stop on phase change — check whether `play()` already supports this; if not, add a `playLoop(name)` / `stopLoop(name)` pair.

No database changes. No new server functions. No changes to `game.functions.ts`.

### Files touched

- `src/components/host/HostGameStage.tsx` — all three beat upgrades
- `src/lib/sounds-client.ts` (or wherever `play()` lives) — add loop/stop support if missing
- Maybe one new file `src/hooks/useCountUp.ts` if the tween is reused

### Acceptance

- Wager phase has visible/audible pulse, lock count animates, all-in players are called out, low bass bed loops.
- Final question phase intensifies visually + audibly under 10s and 5s thresholds.
- Reveal phase has a deliberate pause before the answer slams in, then players roll out bottom-up with score count-up and winner crown.
- Phase 1.6/1.7 voice lines still play on top without conflict.
- No regressions to non-final rounds.

### Out of scope

- New music tracks (uses existing `final` clip, user can swap in admin)
- Camera/confetti for final winner (that's the post-game `leaderboard` celebration, separate polish pass)
- Mobile player-side wager UI polish (host stage only this pass)