# Fix the boot intro cutting off mid-line

## Problem
The trailer VO is three independent `setTimeout` calls into `speakAsElf` (FIFO queue). Lines 2 and 3 stack behind line 1's actual playback, so the real timing slides past the scripted 1.0s / 3.4s / 5.4s schedule. Meanwhile the splash stage hard-advances at 6.2s, then credits runs, then `complete()` fires `cancelElfSpeech()` — which kills whatever line is still draining. Net result: user hears beat 1, beat 2 gets swallowed by the queue, and beat 3 ("Beat. The. Drop.") starts late and gets cut off when the overlay dismisses.

## Fix
Collapse the 3-beat trailer into ONE `speakAsElf` call. The ElevenLabs voice handles the dramatic pauses via `…` natively, and a single line eliminates the queue race entirely.

### `src/components/BootSequence.tsx`

1. **`startBootIntroAudio()`**: replace the three `speakAsElf` blocks with one call at 1000ms:
   ```ts
   void speakAsElf(
     "In a world… of bad answers… and faster fingers… Beat. The. Drop.",
     { preset: "calm", interrupt: true, volume: 1.0 },
   );
   ```
   Keep `playBootMusic(0.78)` and `bootAudioStartedAt = Date.now()` as-is. Keep the `playCrowdCheer()` scheduled at `DROP_BEAT_MS - 200`.

2. **`DROP_BEAT_MS`**: bump from `5400` → `6800` so the logo punch + crowd cheer land on the actual "Drop." word in the combined line (the lead-in is ~5.5s before "Beat").

3. **`STAGE_DURATIONS.splash`**: bump from `6200` → `8800` so the full line (~7.5s of speech + 300ms buffer) finishes before the stage transitions. Credits stage stays at 5200ms.

4. Leave the dismiss-side `cancelElfSpeech()` alone — it still correctly kills any straggling audio when the user skips early.

## Verification
- Fresh load (or `?nosplash=0`), tap gate. Hear the full trailer line uninterrupted, crowd cheer swells on "Drop", logo punches in sync, then credits roll.
- Skip with a tap mid-line: audio cuts cleanly (existing `cancelElfSpeech` on dismiss).
- Standalone PWA: same flow, no gate.
