
## What's actually broken

The drop schedule is racing the fast-forward logic. In `HostGameStage.tsx`:

- Wrong answers are scheduled to drop at remaining = 11s, 7s, 3s.
- BUT: as soon as every live player has locked, a fast-forward fires `endQuestion` after a 3s delay.
- With bots (or fast humans) locking instantly at ~14.5s remaining, the question ends around 11.5s remaining — only the first drop has fired, and the reveal slams in before answers 2 and 3 ever fall off.

That's why you see one answer drop and then the reveal.

## Fix the elimination flow

1. **Drive drops off elapsed time from question start, not remaining time.** Schedule them at +3s, +6s, +9s after the question begins. Always fires regardless of fast-forward.
2. **Gate the fast-forward.** `endQuestion` cannot fire until all 3 wrong answers have dropped AND at least 1s has passed since the last drop. If everyone locks early, we still play out the elimination sequence — the tension is the whole point.
3. **Final beat:** after the last wrong answer falls, the lone correct answer sits alone on screen for ~1s, then the reveal ring/glow plays.

## Wire up the shatter properly

`ShatteredFaces.tsx` already exists and listens to `dropped_indexes` changes — but it only shows faces of players who locked the *just-dropped* index. When a wrong answer falls, every player who picked it gets their selfie smashed across the host screen with a buzzer. That part works once the drops actually fire on schedule. Three things to upgrade:

- Layer the shatter overlay above the question grid (already z-50, confirm it reads).
- Add a heavy screen-shake + red vignette pulse on each drop (host stage only).
- Play a distinct buzzer per drop (already calls `play("wrong")` via the overlay; also call `play("drop")` from the orchestrator — already does).

## Redesign the question stage

Replace the current Kahoot-style colored blocks + cartoon shapes in `QuestionStage.tsx`. New direction:

- **Stage:** deep near-black background with a soft radial spotlight behind the question text. Subtle film grain.
- **Question:** large serif/display headline, centered, with a thin gold underline. Round number + category as small uppercase eyebrow text.
- **Timer:** big circular ring top-right, switches from cool cyan → amber → red as time runs out, with a heartbeat pulse under 5s (keep, but restyle).
- **Answers:** 2×2 grid of glass panels (frosted backdrop-blur, 1px white/10 border, soft inner glow). Each panel has:
  - Letter badge A/B/C/D top-left in a circle
  - Answer text in clean sans, large
  - Bottom strip showing tiny avatars of players who locked it (live)
- **Elimination animation:** when an answer drops, the panel cracks (SVG crack overlay sweeps across), shatters into shards that fly outward, screen shakes, red vignette pulses, buzzer hits, and the `ShatteredFaces` overlay surfaces the victims' selfies in the center.
- **Reveal:** surviving correct panel scales up, gold ring ignites, confetti or light burst, correct-bell sound.
- **Lock-in dots:** replace the dim grey dots row with a thin progress bar showing "X / Y locked" plus the same mini-avatars on each answer panel.

## Files touched

- `src/components/host/HostGameStage.tsx` — rewrite the orchestrator (elapsed-based drop schedule, gated fast-forward, final-correct hold).
- `src/components/host/QuestionStage.tsx` — full visual rewrite (glass panels, spotlight, crack/shatter animation per panel, restyled timer, avatars on panels).
- `src/components/host/LockInDots.tsx` — replace with a progress bar + per-panel avatar strips (or delete and inline into QuestionStage).
- `src/components/host/ShatteredFaces.tsx` — minor: add screen-shake + red vignette companion effect; keep the cracked-face overlay.

No backend, schema, or server-function changes. Pure host-side UI + orchestrator timing fix.

## Open question

Drop cadence — do you want **+3s / +6s / +9s** (snappy, leaves 6s of final tension), or **+4s / +8s / +12s** (slower burn, leaves 3s)? I'll default to **+3 / +6 / +9** unless you say otherwise.
