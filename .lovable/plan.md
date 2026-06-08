## What's happening today

In `src/components/host/HostGameStage.tsx`, `useRevealAutoAdvance` fires `nextQuestion` exactly 6000ms after `reveal` starts. The "Did you know?" voiceover is queued at 3800ms into reveal via `playVoiceUrl(...)`. If the DYK clip is longer than ~2.2 seconds (most are 4–8s), the advance call cuts him off mid-sentence.

## Fix

Make the reveal auto-advance wait for the voice queue to go idle before advancing, with a safety cap so a stuck audio never hangs the game.

### Change in `src/components/host/HostGameStage.tsx` — `useRevealAutoAdvance`

Replace the fixed `setTimeout(..., 6000)` with a small state machine:

1. Wait the existing 6000ms baseline (keeps timing identical for questions without DYK audio).
2. Then poll `isElfSpeaking()` from `@/lib/elf-voice` every 250ms.
3. As soon as it returns `false`, fire the advance.
4. Apply a hard cap of 14000ms total from reveal start so a broken audio element can't freeze the round.
5. Same end-of-round vs next-question branching as today.

Cleanup must clear both the baseline timeout and the polling interval on phase change / unmount.

No other files need to change — `isElfSpeaking()` already exists and tracks every clip routed through the voice queue, including DYK.

## What you'll experience

- Short DYK or no DYK → advances at the usual 6s (no regression).
- Longer DYK → reveal stays on screen until he finishes the sentence, then advances.
- Audio glitch → advances at 14s no matter what so the game never hangs.