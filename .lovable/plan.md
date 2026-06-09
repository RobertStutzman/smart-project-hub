## Problem

When a new question starts, there's a noticeable beat of silence between the question appearing on screen and the announcer's voice starting to read it. Cause:

1. On phase change into `question`, two voice tracks fire:
   - The mid-round callout (`speakAsElf("Question N…", { preset: "hype" })`) at `HostGameStage.tsx:582`.
   - The pre-baked question TTS at `HostGameStage.tsx:320`, scheduled with `setTimeout(..., startMs - Date.now())` — i.e. delayed until `question_started_at`.

2. `question_started_at` is the end of the ~6-second on-screen intro (badge → question text → answers → play). The question text actually appears at ~2s into that intro (`QuestionStage.tsx:97` `showQuestion = introPhase >= 2`).

So the question is visible for ~3–4 seconds before the read starts. The delay used to be there to keep the "Next question!" callout from being trampled — but the user wants the opposite trade-off: callout finishes before the flip, then the read fires the instant the question is on screen.

## Fix

Two small changes, both in `src/components/host/HostGameStage.tsx`:

1. **Hold the callout, then flip.** In the round-callout effect (lines 567–586), keep `speakAsElf` but stop deferring the rest of the intro to "fire and forget." Instead, signal completion through a new ref `calloutDoneAtRef.current = performance.now() + estimatedMs` (or resolve a promise stored on a ref). Used by step 2.

2. **Re-time the question TTS to the moment the question text becomes visible.** Replace the `startMs - Date.now()` delay (line 318) with: wait until the *later* of (a) the question text becoming visible in the intro (≈ `localStart + 2s`, matching `QuestionStage`'s phase-2 boundary) and (b) the callout's estimated end. Then call `playVoiceUrl(url, { interrupt: true, … })`.
   - Source of truth for "question text visible" lives in `QuestionStage`. To avoid lifting that state, mirror its constants here: `INTRO_BUDGET_S = 6`, phase-2 starts at `4s readSecondsLeft remaining` ≈ `2s after local question start`. Anchor on the local question start using a per-question `performance.now()` ref keyed by `current_question_id`, identical pattern to `QuestionStage.tsx:59-62`.
   - Drop the question-started_at-anchored wait entirely so realtime latency variance doesn't reintroduce gaps.

3. **Optional polish:** if the callout is still mid-sentence at the question-visible mark, briefly hold the question read until callout `onEnd` (max ~600ms cap) so the two never overlap. Implement by resolving a `calloutDonePromise` ref from step 1 and `await Promise.race([calloutDone, sleep(600)])` before `playVoiceUrl`.

No DB changes, no server-fn changes, no QuestionStage timing changes — the visual intro keeps its 6-second cadence; only the voice timing moves earlier.

## Verification

Reload host, start a game, advance through Q1 (round opener) and Q2 (mid-round): the callout should finish, the question screen should be already showing, and the question TTS should start within a beat of the text appearing — no dead silence.

## Out of scope

- No changes to the visual intro phases or timings in `QuestionStage.tsx`.
- No changes to the round splash (`RoundSplash.tsx` / `ShutterTransition`).
- No changes to reveal/explanation TTS.
