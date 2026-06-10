## Problem

In `src/routes/host.tsx` (lobby announcer effect, ~lines 431–455), every quip tick does:

```ts
if (isElfSpeaking()) return;   // hard skip
```

Recent changes raised custom-callout volume / length (welcome intros, opener, longer persona lines). The 10s tick now frequently lands while voice is still playing, so it bails entirely and waits another full 10s — quips end up firing only on the rare silent tick.

## Fix (UI/host-route only, no engine changes)

Edit `src/routes/host.tsx`, lobby-quip effect (lines ~431–455):

1. Remove the `isElfSpeaking()` hard-skip in `tick`. `speakPersona` already routes through the single-line elf queue, so a new line will play immediately after the current one finishes — no overlap risk.
2. Add a lightweight backlog guard instead: if more than ~1 quip is already pending in the queue, skip this tick (prevents pile-up if the cadence ever outpaces playback). Easiest signal: track a local `pendingQuips` counter that increments before `speakPersona` and decrements in a `.finally()` on a small wrapper.
3. Keep the 10s fresh-lobby cadence and 25s replay-lobby cadence as-is.

## Verification

- Open `/host`, create a room, sit in the lobby.
- Confirm a quip plays roughly every 10s (allowing for queue tail of the previous line), not "hardly ever".
- Trigger a Play-Again replay lobby; confirm 12s first-quip delay and ~25s cadence still hold.
- No overlap with welcome intro / opener / chyron speech.

## Files

- `src/routes/host.tsx` — single useEffect block, lines ~431–455.

No schema, no server fn, no other components touched.
