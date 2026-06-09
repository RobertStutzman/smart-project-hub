## Goal

On the reveal screen, advance to the next question **the instant The Elf finishes reading "Did you know?"** — never before, never after a fixed pad.

## What's wrong today (in `useRevealAutoAdvance`, `HostGameStage.tsx`)

1. `BASELINE_MS = 6000` — forces a 6-second minimum on reveal even when the explanation is 2 seconds of audio. Feels like dead air.
2. `HARD_CAP_MS = 14000` — yanks to the next question even if the announcer is still talking. Long explanations get clipped.
3. The advance check polls `isElfSpeaking()` every 250ms, which is fine, but only *after* the 6s baseline.

## Fix

Rewrite `useRevealAutoAdvance` so timing is driven by the announcer, not a stopwatch:

1. **Wait for the explanation read to actually start** (it kicks off ~3.8s into reveal — see the `explanationTtsAudioRef` effect at line ~340). Short grace window of ~1s polling for `isElfSpeaking()` to flip *true* first, so we don't race past it.
2. **Once she's speaking, poll every 200ms** for `isElfSpeaking()` to flip false.
3. **The moment it flips false → advance** (no extra breath; user explicitly wants "as soon as announcer is done").
4. **No hard cap.** Replace with a generous safety net (~45s) that only exists to recover from a stuck/never-ending audio element — not to interrupt a normal read.
5. **No-TTS fallback**: if after ~5s of reveal we've never detected speech starting AND `state.current_explanation_tts_url` is null, advance immediately. This covers the 732 unbaked explanations so they don't sit on a silent reveal screen.

Net effect:
- Short 2s explanation → ~2s reveal, then next.
- Long 12s explanation → full 12s read, then next.
- Missing audio → ~5s and move on, no awkward 14s pad.

## Files

- `src/components/host/HostGameStage.tsx` — rewrite `useRevealAutoAdvance` (lines 1467–1537). No other behavior changes.

## Out of scope

- Not touching the 3.8s delay before "Did you know?" starts (that's the reveal card animation timing).
- Not touching final-round reveal (`final_reveal`, separate 7s timer).
- Not re-baking missing narrations (separate ask).
