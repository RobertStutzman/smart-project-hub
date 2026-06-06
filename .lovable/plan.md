
# Make "Did you know?" a hero element on the reveal screen

## What you noticed

The fun fact felt like it flashed by because (a) the card is small (`text-base`, tight padding, tucked under the answer grid) and (b) the reveal screen advances when the host clicks Next — there isn't a fixed 2-second timer, but the card is easy to miss while you're still looking at the answers.

Good news: reveal is already host-paced, so we don't need to add a timer. We just need to make the fact impossible to miss.

## Changes

### 1. Host screen — `src/components/host/QuestionStage.tsx`

Promote the explanation card from a thin strip below the grid to a hero panel:

- **Bigger type**: headline jumps from `text-[10px]` → `text-sm` (still small-caps), body from `text-base / sm:text-lg` → `text-2xl / sm:text-3xl md:text-4xl`, leading relaxed.
- **More breathing room**: padding `px-5 py-3` → `px-8 py-6 sm:px-10 sm:py-8`, rounded-3xl.
- **Stronger frame**: thicker amber border, deeper gradient, subtle glow shadow so it reads as the focal element of the reveal.
- **Entrance**: scale-up + fade (currently just fade + 12px slide), ~0.5s with a slight delay after the correct answer pulses, so the eye lands on it.
- **Same place** (below the grid) — not a new screen, per your pick.

### 2. Player screen — `src/routes/play.tsx` (two spots, lines ~555 and ~613)

Mirror the bump on mobile so players also see the fact clearly: larger type (`text-lg → text-xl`), more padding, same amber styling. Two render sites because the layout differs for correct vs. wrong answerers — both get the same treatment.

### 3. Reading-time guidance (no code change needed)

Reveal is host-controlled, so the host naturally waits. For reference: a typical 1-2 sentence explanation (~20-30 words) needs ~6-8 seconds. If you later want the host to also see a small "give players ~7s" hint next to the Next button, that's a tiny follow-up.

## Out of scope

- No new screen / route.
- No auto-advance timer (would conflict with host pacing).
- No copy or AI changes — the existing explanations just get a louder stage.

## Files

- `src/components/host/QuestionStage.tsx` — explanation card block (~lines 218-237)
- `src/routes/play.tsx` — two explanation blocks (~lines 555-563 and 613-622)
