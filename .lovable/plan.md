
## Goal
Turn the `/dev` harness into a proper debug pack so when something breaks in a real game you can send me one artifact and I can pinpoint the bug without guessing.

## What's missing today
- A red step tells you *what* failed but not the surrounding events, the room state, or what the network/console did in that window.
- The autoplay-blocked ambience warning (seen right now in your console) currently looks identical to a real "crowd file broken" failure — false alarms erode trust in the runner.
- Bot answer errors silently sit in the bot rail; the runner report doesn't mention them.
- No way to reproduce a run: no seed, no question IDs, no scenario deep-link.
- Nothing to paste to me — copy is a text summary, not the raw signal.

## Additions

### 1. Rich run recorder (`src/lib/run-recorder.ts`)
Wraps each run and captures:
- Full `StampedEvent` stream (already emitted; just retain it).
- `fetch` interceptor tagged to the run — records URL, method, status, duration, and short response text for any 4xx/5xx to `/api/*` or Supabase.
- `console.error` / `console.warn` interceptor — last 20 lines with stack.
- Bot roster snapshot (name, state, last error) sampled at each phase change.
- Room-state sampler: on every `phase.change`, pulls `phase`, `round_number`, `current_question_id`, `difficulty_mode` from Supabase and pins them next to the event.
- Autoplay signal: if `ambience.blocked` fires OR no `ambience.start` in 5s AND no user gesture has hit the iframe, the ambience step becomes **skipped ("autoplay blocked, click host iframe")** rather than **failed**. Real failures (crowd started then stopped early, wrong layer) still fail.

Recorder lives in a `useRef` on `RunnerPanel`; wraps/unwraps globals cleanly on start/stop.

### 2. Continue-on-failure
`runScenario` currently `throws` on a few steps (reset/start/intro). Convert those to soft-fail: record + mark, but keep walking so we get the full picture (e.g. "intro fired but no question — timer step still reported").

### 3. "Prime audio" helper
A new small button in `RunnerPanel` that dispatches a synthetic pointerdown into the host iframe and posts a message telling ambience-engine to retry. Removes the biggest false-positive in headless-ish runs.

### 4. Downloadable JSON report
Adds **⬇ JSON** button next to Copy. Produces:
```json
{ "scenario": "...", "passed": false, "steps": [...], "events": [...],
  "fetchErrors": [...], "consoleErrors": [...], "botSnapshots": [...],
  "roomSamples": [...], "userAgent": "...", "commitHash": "..." }
```
Saved as `qa-report-<scenario>-<timestamp>.json`. This is what you paste/upload to me when a game misbehaves.

### 5. Batch history in localStorage
Stores the last 10 batch summaries under `btd.qa.history`. New **History** section in the panel shows a compact list; click to re-load a past summary. Lets us track whether a specific step has been flaking or is a hard regression.

### 6. Scenario deep-link + auto-run
Support `?run=<scenario>` and `?batch=<iter>` on `/dev`. On load, once the room code appears, kick off the run. On finish, copy the JSON report to clipboard and (if requested via `?post=1`) `postMessage` it to the opener. Makes it possible for you to hand me a single URL to click.

### 7. Assertion tie-in
Existing `QAPanel` assertion states get merged into the run report so the JSON has both the step timeline and the QA checklist verdict in one artifact.

## Files touched
- **new** `src/lib/run-recorder.ts` — instrumentation harness (fetch/console wrap, room sampling, event capture).
- **edit** `src/lib/round-runner.ts` — accept `recorder` param, soft-fail transitions, add step detail with recent event tail on failure.
- **edit** `src/components/dev/RunnerPanel.tsx` — Prime-audio button, JSON download, history section, deep-link auto-run.
- **edit** `src/components/dev/QAPanel.tsx` — expose current assertion state via a ref/callback so the recorder can include it.
- **edit** `src/routes/dev.tsx` — pass bot-error snapshot getter into `RunnerPanel`; parse URL params on mount.
- **edit** `src/lib/ambience-engine.ts` — emit an `ambience.blocked` event when autoplay retry loop starts (may already emit; will confirm).

## Non-goals
- No new gameplay changes, no changes to sound or scoring logic.
- Not adding Playwright or CI — everything stays in-browser.

## Acceptance
After this lands:
- Running any scenario yields a downloadable JSON that includes every event, network error, console error, room-state snapshot, and QA assertion verdict — enough for me to diagnose without asking follow-ups.
- Autoplay-blocked ambience is clearly labeled and doesn't fail the run.
- A `/dev?run=full3Round` link kicks off a full test and drops a JSON report on the clipboard automatically.
- Batch history persists across reloads so we can spot flaky vs. hard-broken steps.
