## Problem

On `/host` in the lobby, the TV shows the room code, QR, players, theme/late-joiner controls, and category picker — but **no button to start the game**. The "Start round" button is hidden inside `HostGameStage`, which only renders after the room phase leaves `lobby`. Result: nothing happens, even with players joined and a category picked.

## Fix

Add a prominent **"Start game"** button to the host lobby (`src/routes/host.tsx`) that calls the existing `nextQuestion` server function — same call the in-game "Start round" button makes. On success, the room phase flips to `question` and the host page swaps to `HostGameStage` automatically (already wired via `roomPhase` state).

### Details

- Place the button at the bottom of the right column (under category picker) so it's the natural "last step" after configuring.
- Disable it until **both** a category is selected and at least 1 player has joined; show helper text explaining what's missing.
- Style it as the primary CTA (large, full-width, primary color) so it can't be missed on a TV.
- Wire it to `useServerFn(nextQuestion)` with `{ roomCode, hostSessionId }`.
- Add a `play("whoosh")` sound on click to match the in-game Start button.

No backend changes, no schema changes — purely a UI wiring fix on `src/routes/host.tsx`.
