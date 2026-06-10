## Problem

In `src/routes/host.tsx` lobby-quip effect (lines ~431–452), the tick currently does:

```ts
pendingQuips++;
try {
  await Promise.resolve(speakPersona(spoken, { preset: "hype" }));
} finally {
  pendingQuips--;
}
```

`speakPersona` returns `void` (it swallows the inner `speakAsElf` promise — see `src/lib/host-persona.ts` lines 806–817), so the `await` resolves on the next microtask. The `pendingQuips >= 1` guard never trips, and every 10s tick blindly pushes another line onto the elf-voice queue. After a few minutes the queue is a long backlog of stale quips, so what plays "now" is something requested 60–90s ago — feels like the announcer dropped current quips.

Confirmed in prod: tts_call_log shows cache_hit every 10s on the QR-code screen with no skips, but the actual playback is far behind.

## Fix

Switch the lobby tick to call `speakAsElf` directly (it returns the real queued playback promise) so `pendingQuips` reflects true queue depth and the next tick skips when one is still playing.

1. **`src/routes/host.tsx`** lobby-quip effect:
   - Import `speakAsElf` from `@/lib/elf-voice` inside the tick instead of `speakPersona`.
   - `await speakAsElf(spoken, { preset: "hype", interrupt: false })` so the `finally` only runs once the line actually finishes (or fails).
   - Keep the `pendingQuips >= 1` skip — now it does what was intended (drop a tick if a quip is still in flight, but don't backlog).
   - Keep cadence as-is: 10s fresh lobby, 25s replay.

2. No other files change. The opener still uses `speakPersona` (one-shot at 2.4s, fine to fire-and-forget).

## Verification

- Open `/host` on the published URL, sit in the lobby for ~60s.
- Quips audibly cycle ~every 10–12s (allowing for the tail of each line).
- After 3 minutes of idle, the line you hear matches the recent one — not a 90s-stale one.
- Check `tts_call_log` for the room: cadence should stay ~10s, no infinite stack.
- Trigger a few player joins; welcome line plays, then quips resume on cadence without pile-up.

## Files

- `src/routes/host.tsx` — 5-line change inside the existing lobby-quip useEffect.
