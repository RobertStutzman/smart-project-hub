## Debug Pack: make the QA harness self-diagnosing

### Problem
The current `/dev` QA harness runs scenarios but gives only a pass/fail summary. When a run fails, we need console logs, network errors, room-state snapshots, and the exact event tail to diagnose the bug without back-and-forth.

### Solution
Instrument the QA runner so every run produces a downloadable JSON report containing everything needed to debug a failure offline.

### Deliverables

1. **`src/lib/run-recorder.ts` (new)** — Instrumentation harness
   - Capture the full `StampedEvent` stream from the runner.
   - Wrap `window.fetch`: record URL, method, status, duration, and response body preview for 4xx/5xx.
   - Wrap `console.error`/`console.warn`: keep the last 20 lines.
   - Record bot roster snapshots at the start of each phase.
   - Record room-state samples on every `phase.change` event.
   - Detect autoplay blocks: flag when `ambience.blocked` fires or no `ambience.start` occurs within 5 s without a user gesture.

2. **`src/lib/round-runner.ts` (edit)** — Convert hard failures to soft failures
   - `runScenario` should record a step and continue instead of throwing, marking failed steps clearly.
   - On failure, include the step detail plus the recent event tail from the recorder.
   - Accept a `recorder` parameter so the runner can push events into the report.

3. **`src/components/dev/RunnerPanel.tsx` (edit)** — QA runner UI upgrades
   - Add a **🔊 Prime audio** button that dispatches a synthetic `pointerdown` into the host iframe to unlock the browser audio context.
   - Add a **⬇ JSON** button that downloads the run artifact as `qa-report-<scenario>-<timestamp>.json`.
   - Persist batch-run history in `localStorage` (last 10 runs) and allow reloading a previous report.
   - Support deep-link auto-run: `/dev?run=<scenario>` starts the scenario on load; `/dev?post=1` posts the report to `window.opener` for automated testing.

4. **`src/components/dev/QAPanel.tsx` (edit)** — Expose assertion state
   - Provide a ref or callback so the recorder can include the current assertion verdict in the report.

5. **`src/routes/dev.tsx` (edit)** — Deep-link plumbing
   - Parse `?run` and `?batch` params on mount and pass them into the runner panel.
   - Pass a bot-error snapshot getter into the runner so the recorder can attach the latest bot state.

6. **`src/lib/ambience-engine.ts` (edit)** — Emit autoplay signal
   - Fire an `ambience.blocked` event when the browser prevents autoplay so the recorder can label it as a skip, not a failure.

### Non-goals
- No gameplay or sound-engine logic changes.
- No Playwright/e2e harness; everything runs in the browser.
- No new backend tables or API changes.

### Acceptance criteria
- Running any scenario in `/dev` yields a downloadable JSON report with all events, network errors, console errors, bot snapshots, room-state samples, and QA assertion verdicts.
- When ambience is blocked by autoplay policy, the step is marked skipped (yellow) and labeled `autoplay-blocked`, not failed.
- Visiting `/dev?run=full3Round` automatically starts the full run and downloads the JSON report.
- Batch history persists across page reloads.
- After this lands, you can send me a JSON report from a failed run and I can fix the root cause in one turn.
