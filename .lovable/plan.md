## 1. Replace the lame ✕ with a real elimination beat

`ShatterOverlay` in `src/components/host/QuestionStage.tsx:403-417` is currently a single rose-colored ✕ that fades in. Punching it up while staying inside the tile (no stage shake — per your earlier feedback):

- **Tile jolt**: a one-shot 120ms shake on the answer tile (`x: [0,-6,6,-4,4,0]`), then it locks into the existing dropped/grayscale state. Localized to the tile only.
- **Crack-out slash**: an SVG slash that draws diagonally across the tile in ~250ms using `pathLength` from 0→1, then holds. Rose-glow stroke with a tiny chromatic-aberration shadow so it pops on the TV.
- **Stamped "OUT" badge**: a rotated `-12deg` "OUT" stamp scales in from 1.8→1 with a hard 60ms snap, then settles to a slight tilt. Uppercase display font, rose with a black inner shadow so it reads at distance.
- **Rose ember puff**: ~8 small particles drift up & fade over 600ms inside the tile (cheap CSS — absolute divs animated with framer-motion, no canvas).
- **Audio sting**: keep the existing `play("wrong")` cue; add a short `play("eliminate")` whoosh if a slot is wired in `sound_event_assignments`. If no slot exists, no-op.

All animation is scoped to the dropped tile via `AnimatePresence` keyed on `dropped-${i}`. Total visual time ~700ms, then it sits as the grayed-out dropped state already does. No screen-wide flash, no shake (those got vetoed).

## 2. Phone vibrations — status check

Good news: **they're already wired up.** `src/hooks/use-haptics.ts` calls `navigator.vibrate` and `src/routes/play.tsx:225,236,238` already fires on wrong answer, correct reveal, and elimination drop. Plus tap haptics on button presses.

Bad news about iOS: **iPhone Safari does not support the Vibration API at all** — there is no JS hook to trigger Taptic Engine from a web page. Chrome/Firefox on iOS also can't (Apple's restriction). Android Chrome/Firefox/Samsung Internet works fine.

If you're testing on iPhone, that's why nothing buzzes — it's a platform limitation, not our bug. If you want, I can:
- **A.** Strengthen the Android patterns so they're more noticeable on devices that do support it (longer / more dramatic for `wrong` and `drop`).
- **B.** Add a subtle on-screen "buzz" pulse + a short red flash inside the player's answer chip for iOS users so they get *some* tactile-feeling feedback (visual proxy).
- **C.** Both.

Implementing the elimination animation regardless. **Which of A / B / C do you want for vibrations?**