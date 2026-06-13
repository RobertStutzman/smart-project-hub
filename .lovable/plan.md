## Problem
The full-screen "Did you know?" card flips in at **2200ms** after the reveal phase starts (`QuestionStage.tsx:189`), but the announcer's TTS read isn't triggered until **3800ms** (`HostGameStage.tsx:425-438`). That's ~1.6s of dead air where the card sits on screen with no voice. The TTS call also queues behind any in-flight persona reaction, which can add more lag.

## Fix
Align the announcer with the card flip — cut the explanation TTS delay from 3800ms to **2400ms** (200ms breath after the card lands so the voice doesn't step on the flip animation).

### Change
`src/components/host/HostGameStage.tsx` line 425:
```ts
const timer = window.setTimeout(() => { ... }, 3800);
```
→ change to `2400` and update the inline comment to match.

### Knock-on
`HostGameStage.tsx:1835-1837` has a `SPEECH_START_DEADLINE_MS = 7000` for the reveal auto-advance "did the explanation actually start speaking" gate. That deadline is the **max** time we'll wait before giving up — pulling the start earlier only widens the safety margin, so no change needed. Leaving it.

No backend / server-fn changes. The TTS URL is already pre-baked (`current_explanation_tts_url`) so there's no network latency to chase.

## Verify
In preview, play through a question, watch the reveal: the "Did you know?" card flips in and the announcer voice should start within ~200ms of it landing, not 1.5s later.
