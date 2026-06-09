## Goal

After the user taps "Tap or press any key to begin," the next two screens (splash + credits) flash by before their animations finish, and the transitions feel snappy/clunky. Slow them down and smooth the crossfades.

## Changes — `src/components/BootSequence.tsx`

### 1. Stage durations
Currently splash = 2200ms, credits = 4000ms. The splash subtitle alone doesn't finish animating until ~1700ms, leaving only ~500ms of read time before it auto-advances.

- `splash`: 2200 → **3400ms** (subtitle fully in by 1.7s, then ~1.7s read/breathe)
- `credits`: 4000 → **5200ms** (dots in by 2.2s, then ~3s to read the tagline)

### 2. Smoother stage transitions
The current `AnimatePresence mode="wait"` between gate → splash → credits causes a brief blank gap (exit must finish before enter starts). Replace with a clean crossfade:

- Switch the inner `<AnimatePresence mode="wait">` to **default mode** (concurrent) so the next stage fades in while the previous fades out.
- Bump each stage's `initial`/`exit` durations from ~0.4–0.6s to **0.7s** with a soft `ease: [0.22, 1, 0.36, 1]` for a polished crossfade.

### 3. Gate → splash handoff
On the user's tap, the gate currently snaps to splash. Keep behavior (audio unlock + advance) but smooth the handoff:

- Add a 100ms tap acknowledgement on the Tap-to-begin pill (scale 1 → 0.97 → 1) before switching stage. Purely visual; no logic change.
- The crossfade above takes care of the rest.

### 4. Final dismiss → landing
The whole boot overlay fades out in 400ms — short and the landing pops in abruptly. Bump dismiss to **600ms** with the same soft easing so it melts into the landing page.

## Out of scope
- Stage content, copy, audio cues, ambience start-up, and the "press any key to skip" affordance are untouched.

## Result
Tap-to-begin → soft press → crossfade into splash (3.4s) → crossfade into credits (5.2s) → fade into landing (0.6s). No more flashy hard cuts; each stage has room to breathe.
