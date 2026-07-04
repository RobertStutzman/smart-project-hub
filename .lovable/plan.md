# Fix: batch runner hang at "Send parent:start-game and observe intro phase"

## Root cause (single bug, all scenarios)

`src/routes/host.tsx` registers its `window` message listener in a `useEffect` with dep array `[createRoomFn]` (L395). The effect only runs once. Its `onMsg` closure captures `actuallyStart`, which in turn closes over `room` — and on first render `room` is `null`.

When the QA runner posts `parent:start-game`, the handler invokes that stale `actuallyStart`. The very first line is `if (!room) return;` (L880). Silent bail. No `restartGame`, no `setPhase("intro")`, no phase change ever fires — so the runner's `waitForEvent(phase.change=intro)` times out at 8s, then `climax` waits another 60s, then the next scenario resets and hits the same wall. That's the entire 15-minute batch.

Evidence:
- Artifact `data.events` never contains `phase: "intro"` — only repeated `phase: "lobby"`.
- Network log during the hang shows only `heartbeatHost` polling — zero `restartGame` / `setPhase` calls. If `actuallyStart` had run, both would appear.
- `parent:new-room` works (bots joined the room in the same run) because that handler creates a fresh room via `createRoomFn` and doesn't depend on stale `room`.

## Fix

`src/routes/host.tsx`, the message-listener `useEffect` block (~L346-395):

Add a ref that always tracks the latest `actuallyStart`, and dispatch through it.

```tsx
// Sits alongside the existing function declaration.
const actuallyStartRef = useRef<() => void>(() => {});
useEffect(() => { actuallyStartRef.current = () => { void actuallyStart(); }; });

// Inside the parent:start-game branch:
if (data?.type === "parent:start-game") {
  try { window.parent?.postMessage({ type: "host:start-ack" }, "*"); } catch {}
  actuallyStartRef.current();
  return;
}
```

Why a ref and not a dep-array fix: the listener effect intentionally registers once (adding/removing a `window` listener on every `room` change is churn we don't want, and would drop in-flight messages during re-registration). A ref keeps one stable listener while always calling the current `actuallyStart`.

`parent:new-room` stays as-is — it doesn't depend on stale `room`.

## Acceptance
- Re-run any batch scenario on `/dev`: after `Spawn 4 bots`, `parent:start-game` produces a `restartGame` + `setPhase(intro)` POST pair in the network tab, and the runner observes `phase.change=intro` within 8s.
- Batch of 5 scenarios × 3 iterations completes in the expected ~5-8 min rather than hanging 15+ min.
- No regression to the Start button on `/host` (still calls `actuallyStart` directly via `handleStartClick`).

## Non-goals
- No change to `actuallyStart` itself, `restartGameFn`, or `setPhaseFn`.
- No change to the runner (`round-runner.ts`) — its `waitForEvent(intro)` was correct all along; it just wasn't getting the event.
- Not touching the `parent:new-room` handler.
- Ambience autoplay skip (the sandbox `ambience.blocked` in this artifact) is expected without a user gesture and is already handled by the runner via `Prime audio`. Not in scope.

## Technical notes
- The ref pattern (assign in a bare `useEffect` with no deps) is React's canonical way to bridge a stable listener to an ever-changing callback. It fires on every render, so the ref always points at the latest closure.
- `actuallyStartRef.current` is intentionally void-returning; the handler doesn't await it (the runner is watching the phase.change stream, not the RPC).
