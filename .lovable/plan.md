Two fixes for the host TV game stage.

## Fix 1 — Kill the white flash and shake when a wrong answer is eliminated

### Cause
In `src/components/host/QuestionStage.tsx`:
- Line 109: `<motion.div key={shakeKey} …>` re-keys the entire stage on every drop, unmounting/remounting the whole tree. Backdrop-blur compositing for a frame reads as a white flash on TV.
- Lines 110-114: the whole stage animates `x` and `y` through a 6-step jerk — the shake.

### Changes
1. Remove `key={shakeKey}` from the root `motion.div` so children never unmount on a drop. No more flash.
2. Remove the stage-wide x/y shake animation.
3. Remove the now-unused `shakeKey` state and its `useEffect`.

The eliminated tile already gets a grayscale + rose ✕ stamp + rose border, so feedback stays clear.

## Fix 2 — Make the "Question N" intro reliably long (no random shortening)

### Cause
The intro window is set server-side as `question_started_at = serverNow + 3500ms`. The host TV computes how long to show the intro as `(question_started_at − clientNow)`. Any realtime delivery latency or clock skew between server and client eats into that window. Different latency each round → "intro got shorter randomly."

### Changes
1. `src/lib/game.functions.ts` line 236: bump the budget from `+ 3500` to `+ 6000` so even with latency there's headroom.

2. `src/components/host/QuestionStage.tsx`: anchor the intro on **when the host first observes the new question**, not on server-side absolute time. Approach:
   - Track the current `questionText`/`questionNumber` in a ref. When it changes, record `clientStartMs = performance.now()` for this question.
   - Compute a local `localReadSecondsLeft = max(0, 6 − (performance.now() − clientStartMs) / 1000)`.
   - Use the larger of `localReadSecondsLeft` and the existing `readSecondsLeft` prop. That guarantees the intro is never shorter than the full local budget, even when the server-derived value arrives with latency baked in.

3. Re-split the 6s budget in the phased intro (lines 53-59):
   - Badge "Question N": `readSecondsLeft > 4.0` (≈2.0s)
   - Question fades in: `readSecondsLeft > 2.0` (≈2.0s)
   - Answers stagger in: final ≈2.0s
   Update the comment block to match.

4. Adjust the tick-SFX stagger in lines 64-77 so the per-answer ticks still align with the new ≈2.0s answer-reveal phase (currently `700 + i*110`ms → change to `0 + i*400`ms scheduled from the start of the answers phase, or simply lengthen the existing delays proportionally).

### Verification
- Trigger a wrong-answer drop in the preview: no flash, no shake, eliminated tile still shows ✕ + grayscale.
- Trigger multiple questions back-to-back: "Question N" badge holds ≈2s every time, question text appears for ≈2s, answers stagger in for ≈2s, then the lock-in timer starts.