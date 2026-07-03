## Goal

Give you a single page (`/dev`) where you can run a whole game end-to-end with bots and see, in real time, whether the things we've been fixing are actually working — with pass/fail lights instead of you having to catch regressions by ear/eye.

## What exists today

`/dev` already spawns bots into a host iframe and answers questions. It has no observability: you still have to watch and listen to know if anything broke.

## What I'll add

### 1. Lightweight in-app event bus (`src/lib/debug-bus.ts`)

A tiny `window.__btdDebug` pub/sub that the key subsystems emit into. No behavior change in production — it's a fire-and-forget `emit()` that's a no-op when no listener is attached.

Events emitted from the code that has been regressing:

- `ambience.start` / `ambience.stop` / `ambience.blocked` — from `ambience-engine.ts`
- `music.start` / `music.stop` — from `sound-engine.ts` music helpers
- `phase.change` — from host phase transitions (lobby / intro / question / reveal / round / final / results)
- `question.show` `{ index, roundLabel, category, difficulty }` — from `QuestionStage`
- `countdown.show` `{ kind: "get-ready" | "big-321" | "final" }` — from IntroStage / final intro
- `timer.start` `{ phase, durationMs }` — whenever a question/final timer is armed
- `drop.answer` `{ index }` — lightning-round anti-drop check (should NEVER fire in lightning)
- `tts.speak` `{ preset, text }` — announcer lines
- `final.question` `{ difficulty, questionId }` — final-round question metadata

Every emit is one line of code near where the behavior happens. No refactors.

### 2. QA panel on `/dev`

New right-hand column next to the bot rail with three sections:

**a) Assertions (auto-graded checklist).** Rules encoded as small functions that consume the event stream. Each row shows ⚪ pending / ✅ pass / ❌ fail with the offending event on failure. Initial rules covering the recent regressions:

- Lobby ambience: `ambience.start(chatter|crowd)` fires within 5s of `phase.change(lobby)`; still playing when `phase.change(intro)` arrives.
- No giant 3-2-1 countdown: `countdown.show({kind:"big-321"})` must NOT fire between lobby → question.
- Question label: on `question.show`, `roundLabel` for final round is `"Final"` (never `"Question 1"`).
- Question timer duration: `timer.start` for regular questions is 15s ± tolerance, mid-round adjusts as configured; final is 30s.
- Lightning round no-drop: while `phase` indicates lightning, no `drop.answer` events fire.
- Final music: `music.start("final")` fires within 2s of final intro, not the "bouncing beeping" preset.
- Final question difficulty: `final.question.difficulty === "hard"`.
- Announcer sanity: no `tts.speak` whose text is a bare number ("2", "3") during phase transitions (catches the "just said 2 and started" bug).

**b) Live event log.** Scrollable, filterable, timestamped. Copy-to-clipboard button so you can paste it into a bug report.

**c) One-click scenarios.** Buttons that drive a full run: `Full 3-round game (smart bots)`, `Lightning round only`, `Final round only`, `Return-to-lobby stress (game → new room ×3)`. Each scenario spawns bots, waits for the host to reach the right phase, advances via the existing host controls (already exposed through `postMessage`), and reports the assertion summary at the end.

### 3. Optional: headless mode flag

Add `?auto=1` to `/dev` to auto-run the "Full 3-round game" scenario on load and print `PASS`/`FAIL` to the console + a big banner. Useful when you want to spot-check after a change without clicking anything.

## Files

- **New** `src/lib/debug-bus.ts` — event bus + types.
- **New** `src/components/dev/QAPanel.tsx` — assertions, log, scenario buttons.
- **Edit** `src/routes/dev.tsx` — mount `QAPanel`, wire scenarios.
- **Edit (one-line emits, no logic changes)**:
  - `src/lib/ambience-engine.ts`
  - `src/lib/sound-engine.ts` (music start/stop)
  - `src/routes/host.tsx` (phase.change)
  - `src/components/host/QuestionStage.tsx` (question.show, timer.start)
  - `src/components/host/IntroStage.tsx` (countdown.show)
  - `src/components/host/FinalIntroStage.tsx` / `FinalStages.tsx` (final.question, countdown.show)
  - `src/lib/game.functions.ts` — emit `drop.answer` in the lightning branch guard so tests catch regressions from the client side (or emit from the host reveal handler that receives dropped_indexes)
  - `src/lib/announcer.functions.ts` client wrapper (`tts.speak`)

## Non-goals

- Not adding a full test runner (Vitest/Playwright) yet — this is a live in-app harness you can trigger between rounds without leaving the preview.
- Not changing any gameplay behavior. Emits are additive.
- Not persisting results across reloads (session-only). Can add later if you want history.

## What you get after this ships

Open `/dev`, click **Full 3-round game**, watch the checklist fill in as the bots play. If final round accidentally re-labels itself "Question 1" or the lobby ambience goes silent, you see a red ❌ with the exact event and timestamp, before you have to hear it yourself.
