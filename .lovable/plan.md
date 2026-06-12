# Fix How-to-Play slides cutting off narration

## Problem
`src/components/HowToPlay.tsx` advances every 5500ms on a fixed timer. The announcer's TTS line ("Title. Body.") often runs longer than that, so the next slide fires `speakPersona(..., { interrupt: true })` which calls `cancelElfSpeech()` and kills the previous line mid-sentence.

## Fix
Drive slide advancement from the narration lifecycle, not a fixed timer.

### `src/components/HowToPlay.tsx`
- Replace the fixed `SLIDE_MS` timeout with a "speak then advance" effect:
  1. On each slide, await `speakPersona(line, { preset: "hype" })` (no `interrupt: true` on the first slide; subsequent slides will naturally queue since the prior slide has finished).
  2. After the speech promise resolves, hold for a short beat (~600ms) so the words don't slam into the next title card, then advance (or call `onComplete` on the last slide).
  3. Apply a safety ceiling (e.g. 9s) so a hung TTS request can't freeze the intro — if it fires, cancel the line and advance.
- Keep the cancel-on-unmount and skip-on-keypress behavior. Skip should `cancelElfSpeech()` and call `onComplete`.
- Remove the now-unused `SLIDE_MS` constant.

### Notes
- `speakPersona` already returns a promise that resolves when the singleton audio element finishes (`playUrl` resolves on `ended`/`pause`/`error`).
- No changes to `elf-voice.ts`, `host-persona.ts`, or any other component.
- Pure presentation/timing change; no business logic touched.

## Verification
- Load preview, click to unlock audio, watch the 3 How-to-Play slides — each line should complete before the next slide animates in.
- Press a key mid-slide → narration cuts and overlay closes immediately.
