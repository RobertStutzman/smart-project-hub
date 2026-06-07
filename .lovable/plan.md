## Goal

Replace the giant 3-2-1 countdown with a voice-paced, multi-phase reveal that feels like HQ Trivia / Jackbox — premium, snappy, and synchronized to the AI narration instead of a mechanical counter.

## The new transition (≈2.5–3.5s total, paced by voice)

```text
Phase 0  REVEAL HOLD  (current question)
   |
   v
Phase 1  DIM + STING       0 → 700ms
   • Current question dims to ~15% opacity + 6px blur
   • Whoosh/swoosh SFX (low, short)
   • Centered badge fades in: "QUESTION 5" with thin gold underline
   • AI voice ducks music and says "Alright, next one…" / "Here we go…"
   |
   v
Phase 2  QUESTION REVEAL   700 → 1400ms
   • Badge slides up & fades out
   • New question text fades + slides in (y: 16 → 0, 350ms, ease-out)
   • Voice begins reading the question (TTS starts at 900ms)
   |
   v
Phase 3  ANSWER STAGGER    1400 → 1900ms (overlaps with TTS)
   • Cards A → B → C → D fade + scale in (0.94 → 1)
   • 110ms stagger between cards
   • Soft "tick" SFX on each card landing (volume low)
   • Letter badges (A/B/C/D) pop with a tiny bounce
   |
   v
Phase 4  ARM TIMER         after TTS finishes
   • Timer ring fades in (300ms) at full size
   • First tick = first second of lock window
   • Music un-ducks to normal level
```

No giant numbers. No 3-2-1. Pacing comes from the voice + staggered motion.

## Audio choreography

- **Whoosh** at Phase 1 start (existing sound engine, low gain ~0.4)
- **Voice intro** ("Alright, next one!" / "Here we go!" / "Lock in!") during Phase 1, music ducked to 25%
- **Question TTS** starts at Phase 2 (~900ms in), music stays ducked
- **Tick SFX** on each answer card landing (very subtle, ~0.2 gain)
- **Music un-ducks** when TTS ends and timer arms

Voice + SFX never overlap: intro voice finishes before question TTS starts (already enforced via the `speechSynthesis.speaking` guard in `HostGameStage`).

## Visual details

- **Badge:** `font-display`, `text-4xl sm:text-5xl`, white with amber underline (`w-16 h-[2px] bg-amber-300`). Subtitle below: "Get ready" in `text-[10px] tracking-[0.5em] text-amber-300/70`.
- **Question entrance:** existing styling, just animated in with `motion.h2` (opacity 0→1, y 16→0, 350ms).
- **Answer entrance:** wrap each card in `motion.div` with `transition={{ delay: i * 0.11 + 0.7, duration: 0.35 }}`. Replace current always-on `initial={{ scale: 0.96 }}`.
- **Dim overlay:** absolute inset-0, `bg-black/70 backdrop-blur-md`, fades in/out during Phase 1.
- **No screen-wide countdown number.**

## Timing source of truth

Keep the existing `question_started_at = now + 3500ms` server delay so all clients are synchronized. Derive phases on the client from `readSecondsLeft`:

```text
readSecondsLeft > 2.8   → Phase 1 (dim + badge + intro voice)
readSecondsLeft 2.8–2.1 → Phase 2 (question fades in, TTS starts)
readSecondsLeft 2.1–1.6 → Phase 3 (answers stagger in)
readSecondsLeft <= 0    → Phase 4 (timer armed, normal play)
```

## Files to change

1. **`src/components/host/QuestionStage.tsx`**
   - Remove the giant `clamp(8rem, 28vw, 22rem)` countdown overlay.
   - Add a new `<IntroOverlay phase={...} questionNumber={n} />` component for Phase 1 (dim + "QUESTION N" badge).
   - Animate the question `<h2>` entrance keyed to `readSecondsLeft` crossing the Phase 2 threshold.
   - Wrap each answer tile in a `motion.div` with staggered `delay` based on its index, gated by Phase 3.
   - Keep `TimerRing` hidden during `reading`; fade it in when reading ends.
   - Accept a new prop `questionNumber: number` (passed from `HostGameStage`).

2. **`src/components/host/HostGameStage.tsx`**
   - Pass `questionNumber` (current index + 1) into `QuestionStage`.
   - Keep the existing voice intro logic; shorten lines to be snappier ("Next!", "Here we go!", "Lock in!").
   - Trigger a `whoosh` SFX at the start of `reading` via `soundEngine` (alongside the existing voice).
   - Keep the TTS delay logic that waits for `question_started_at`.

3. **`src/lib/sound-engine.ts`**
   - Add two tiny SFX helpers if not already present:
     - `playWhoosh()` — short downward sweep, ~250ms, low gain.
     - `playTick()` — short click, ~60ms, very low gain. Called 4× staggered from `QuestionStage` as answers land.
   - Reuse existing duck/un-duck for music.

4. **`src/lib/game.functions.ts`** — **no change**. The 3.5s `question_started_at` delay already gives us the window we need.

## Non-goals (explicitly out of scope)

- No backend / scoring changes.
- No change to phone player UI.
- No new assets or fonts.
- No change to the reveal phase, explanation card, or leaderboard.

## Validation

- Watch a full question cycle in the preview: confirm dim → badge → question fade → answer stagger → timer arm, with voice intro finishing before question TTS starts.
- Confirm no white flashes, no overlapping voices, no layout shift when answers stagger in.
- Confirm music ducks during voice and un-ducks when timer arms.
