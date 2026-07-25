## What's happening

Between questions, `nextQuestion` on the server flips the room to a transient `phase: "advancing"` (a compare-and-swap guard against double-taps) before it lands on the next `question` phase. `HostGameStage.tsx` has an explicit branch for every known phase and then a final `return` that renders the lobby "🎬 Start the show" button for anything it doesn't recognize — including `advancing`. So for the fraction of a second the room sits in `advancing`, the host screen shows the Start-the-show CTA. If the user taps it, it would even try to re-enter intro.

## Fix

Change the fallback in `src/components/host/HostGameStage.tsx` (around line 1894) so it only shows the Start-the-show button when `state.phase === "lobby"`. For any other unrecognized/transient phase (`advancing`, and any future phases), render a lightweight "Loading next question…" placeholder instead — no button, no phase-change action.

Concretely:
- Wrap the current lobby JSX in `if (state.phase === "lobby") { return ... }`.
- After it, return a minimal centered spinner / "…" panel styled to match the stage background so the transition is invisible in practice.

That's the whole change — it removes the misleading CTA between questions without touching game logic, server functions, or the auto-advance timing.

## Technical notes

- Root cause is the catch-all `return` at the bottom of the phase switch in `HostGameStage`, combined with the `"advancing"` transient set inside `nextQuestion` in `src/lib/game.functions.ts` (line ~149).
- No server-side change needed; the transient is intentional for race protection.
- No changes to `useRevealAutoAdvance`, `RoundSplash`, or `ShutterTransition`.