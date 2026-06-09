## Problem

On `/play`, answer tiles are disabled and dimmed to 50% opacity whenever `reading === true`. `reading` is computed purely from the device clock:

```ts
readSecondsLeft = (startMs - Date.now()) / 1000   // startMs = question_started_at from server
reading = readSecondsLeft > 0 && phase === "question"
```

The host writes `question_started_at = serverNow + 6000ms` (6s reading lead-in, 2.5s for sudden death). If the player's phone clock is even a few seconds behind the server (common on Kindle/Silk and older Android/iOS devices that don't aggressively sync NTP), `startMs - Date.now()` stays positive for the entire question window. Result: tiles look greyed out, taps do nothing, the "super dark" feel comes from the persistent dim + heartbeat vignette never releasing.

This explains the user's symptoms on Silk on iPhone: "couldn't select any answers, UX super dark."

## Fix

Compute a server-clock offset on the client and use server time (not device time) for the reading/remaining calculations.

### 1. Derive `serverOffsetMs` in `src/routes/play.tsx`

- Add `const [serverOffsetMs, setServerOffsetMs] = useState(0)`.
- Every time we receive a fresh room row (initial fetch + every realtime update), compare `room.host_last_seen_at` (server-written ISO, refreshed by host heartbeat every few seconds) to local `Date.now()` at receipt:
  ```ts
  const offset = Date.parse(row.host_last_seen_at) - Date.now();
  setServerOffsetMs(offset);
  ```
  Apply only when the timestamp is recent (< 30s old by local clock) so we don't anchor to a stale value when the host is gone.

### 2. Use server time everywhere it matters

Replace `now` (local) with `serverNow = now + serverOffsetMs` in the three time-derived values:
- `readSecondsLeft = max(0, (startMs - serverNow) / 1000)`
- `remainingS` calculation
- The "host stale" check still uses local now vs `host_last_seen_at` directly (already self-consistent).

### 3. Belt-and-suspenders clamp

Even if offset detection somehow fails, clamp `readSecondsLeft` to a sane max: if it exceeds 10s (lead-in is at most 6s), treat as 0. This guarantees tiles unlock once the question phase has been active beyond the lead-in window.

### 4. No other UI changes

`buttonsScrambled`, the heartbeat vignette, and the dim/disabled styling stay as-is — they'll behave correctly once `reading` releases on schedule.

## Files touched

- `src/routes/play.tsx` — add offset state, update room-fetch + realtime handlers to set it, update `readSecondsLeft` / `remainingS`, add 10s clamp on reading.

## Verification

- Manually set device clock backwards 30s in a browser devtools / system settings and confirm tiles become tappable as soon as the lead-in elapses.
- Confirm normal-clock devices behave identically to today (offset ≈ 0).
- Confirm "Locked" confirmation and reveal styling still work.
