# Fix #2 — "Did you know?" cut off before winner screen

## Problem
After the final question's reveal, the announcer's "Did you know?" gets cut mid-sentence as the screen flips to the winner crowning.

## Root cause
In `src/components/host/HostGameStage.tsx` Effect A (lines 1044–1056), the `final_reveal → ended` transition uses a fixed 7-second timeout regardless of whether the explanation TTS is still playing:

```ts
if (phase === "final_reveal") {
  if (topScoreTied) return;
  const id = window.setTimeout(() => endGameFn(...), 7000);
  return () => window.clearTimeout(id);
}
```

The regular per-question reveal already solves this — `useRevealAutoAdvance` polls `getExplanationStateFor(qid).ended` (from `src/lib/explanation-playback.ts`) and only advances once the explanation has actually finished, with a 45 s safety cap to catch hung audio. The final reveal never got that treatment.

## Fix
Replace the fixed 7 s timer for `final_reveal` with the same explanation-aware polling loop used by `useRevealAutoAdvance`:

- Wait for `getExplanationStateFor(state.current_question_id)` to report `expected && ended`, then call `endGameFn`.
- If no explanation is expected for the final question, fall back to the existing "persona reaction finished" heuristic (`isElfSpeaking` having gone true→false), with a 7 s floor so we don't snap the winner screen up the instant the sting ends.
- 45 s safety cap — same as the regular reveal — so a stuck audio element never strands us on the final reveal.
- Keep the `topScoreTied` early-return so sudden death still works.

The poll mirrors the existing implementation; the only differences are the target phase (`final_reveal`) and the advance action (`endGameFn` instead of `nextQuestion`/`setPhase`).

## File
- `src/components/host/HostGameStage.tsx` — replace the `final_reveal` branch inside Effect A (lines ~1044–1056) with the polling loop. Add `getExplanationStateFor` import if not already used in this scope (it's used elsewhere in the file via the shared module).

## Verification
Dry-run through the final question. After the reveal, the winner screen should only appear after the announcer finishes the full "Did you know?" line.

Then we move on to #3 (winner screen / credits roll smoothness, graffiti polish).
