
## Goal

Add a one-click "Run automated round" harness on `/dev` that drives a real game from lobby → intro → question → reveal → climax/final without any manual clicks, then prints a pass/fail report based on the QA assertions + a scenario-specific checklist.

## How it works

The `/dev` page already:
- Embeds `/host` in an iframe (creates the room, emits `phase.change` etc. through the debug bus).
- Can spawn bots that join and lock answers via server functions.
- Subscribes to the debug bus via `QAPanel`.

The runner is a small state machine on top of those pieces. It listens to the debug bus, advances by observing events (not timers), and only *nudges* the host when a phase needs a manual click (e.g. "Start game" from lobby, "Next round").

### New file: `src/lib/round-runner.ts`
Pure controller. Given `{ roomCode, iframe, spawnBots, waitForEvent, emit }`, it exposes:
- `run(scenario)` where scenario ∈ `full3Round | lightningOnly | finalOnly | lobbyStress`
- Returns `RunnerReport { steps: StepResult[], assertions: AssertionResult[], passed: boolean }`

Uses `waitForEvent(predicate, timeoutMs)` built on `subscribeDebugBus`. Each step records `{ label, ok, detail, elapsedMs }`.

### Host-side control messages (host.tsx)
Extend the existing `parent:*` postMessage protocol with:
- `parent:start-game` → same effect as clicking "Start" (host advances lobby → intro)
- `parent:advance` → click primary CTA on current stage (Next / Continue / Start round)
- `parent:force-phase` (debug-only, gated on `import.meta.env.DEV`) — optional escape hatch; not required for the happy path.

The runner prefers `parent:start-game` / `parent:advance` (they mirror real user clicks and exercise the real code paths). Host wires them by calling the same handlers its buttons already use.

### Runner flow (full 3-round scenario)
1. `parent:new-room` → wait for `host:room` (get roomCode).
2. Wait for `phase.change: lobby` → assert lobby crowd ambience within 5s (reuses `A.lobbyAmbience`).
3. Spawn N bots (default 4) → wait until all report `lobby`.
4. `parent:start-game` → wait for `phase.change: intro`.
5. For each round r ∈ 1..3:
   - Wait for `question.show` → assert `no.big321` (no `countdown.show` between phase change and question).
   - Assert timer window via `timer.start` (15–25s regular, ~30s final).
   - Ask each bot to lock an answer (existing smart/random logic).
   - Wait for `phase.change: reveal` (or scoreboard/climax event, whichever fires).
   - If lightning round: assert `lightning.nodrop` (no `drop.answer` events during the round window).
   - `parent:advance` to next round.
6. Final round: assert `final.difficulty`, `final.timer`, `final.music`, no bare-number TTS.
7. Wait for climax/handoff phase (`phase.change: final-reveal` or `climax`) → mark run complete.
8. Compile report from step results + current `QAPanel` assertion states.

Each `waitForEvent` has a scenario-appropriate timeout (e.g. 20s for phase transitions, 40s for question resolution). Timeouts mark the step failed but the runner keeps going so the report shows *where* it broke.

### New file: `src/components/dev/RunnerPanel.tsx`
UI on `/dev` above/next to `QAPanel`:
- Scenario dropdown: Full 3-round | Lightning only | Final only | Lobby stress.
- Bot count + mode (reuses existing dev controls).
- Buttons: "Run", "Stop", "Copy report".
- Live step list rendering `StepResult[]` (green check / red x / spinner + elapsedMs + detail).
- Final banner: PASSED / FAILED (X / Y steps, Z assertions).

Runner calls back into `dev.tsx` for `spawnBot` and postMessage; no duplication.

### Instrumentation gaps to close
Confirmed present: `phase.change`, `ambience.*`, `music.*`, `question.show`, `countdown.show`, `timer.start`, `tts.speak`. Add if missing (small emits, no behavior change):
- `drop.answer` inside lightning-round guard in `src/lib/game.functions.ts` (client-side no-op wrapper if server-only — emitted from host on receiving lightning state)
- `round.end` / `climax.start` in `host.tsx` when transitioning out of the last question and into the final reveal, so the runner has a clean terminator.

### Non-goals
- No Vitest/Playwright. Runs entirely in-browser on `/dev`.
- No changes to gameplay, audio, or scoring logic.
- No persistence of reports (copy-to-clipboard only).

## Files touched
- **new** `src/lib/round-runner.ts` — scenario state machine + report type.
- **new** `src/components/dev/RunnerPanel.tsx` — UI.
- **edit** `src/routes/dev.tsx` — mount `RunnerPanel`, expose `spawnBot`/postMessage handle to it.
- **edit** `src/routes/host.tsx` — accept `parent:start-game` / `parent:advance`; add `climax.start` emit at final handoff.
- **edit** `src/lib/debug-bus.ts` — add `climax.start`, `round.end`, `drop.answer` event types (if not already).
- **edit** `src/lib/game.functions.ts` *(only if needed)* — emit `drop.answer` client-side when a lightning-round answer is dropped.

## Acceptance
Clicking "Run — Full 3-round" on `/dev` with 4 bots:
- Advances lobby → intro → 3 questions → final → climax with zero manual clicks.
- Produces a step list where every step is green.
- QA assertions in the existing panel all resolve to pass.
- If a regression appears (e.g. big 3-2-1 comes back, lobby ambience silent, final too easy), the exact failing step + assertion is shown with timing.
