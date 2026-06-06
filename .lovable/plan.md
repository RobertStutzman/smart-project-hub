## What I verified in the live preview

End-to-end smoke test on the running app:

1. Opened `/host` → room **KMBU** generated, QR rendered, lobby music started.
2. Opened `/join?code=KMBU` on a phone-sized viewport → code was pre-filled and sanitized correctly, Next button activated as soon as nickname was typed, `joinRoom` server fn returned `200` with a `playerId`.
3. Skipped the selfie → routed to `/play` (waiting room). All good.
4. Navigated back to `/host` → **a brand new room `ZDUG` was generated**, even though the host session ID in localStorage was unchanged. The previously joined player (TestBot) is now stranded in the abandoned room KMBU — host is no longer heartbeating it and will never call `nextQuestion` on it.

This is almost certainly the real "I don't see start" bug on mobile. Any time the host page remounts (HMR after a code change, refresh, theme nav, back/forward), a fresh room is minted and every connected player is silently orphaned.

## Root cause

`src/lib/rooms.functions.ts` → `createRoom` always inserts a new `rooms` row. It never checks whether the same `hostSessionId` already has a non-ended room. The client passes the persisted `hostSessionId`, but the server ignores it for resume purposes.

## Fix

### 1. Resume on the server (primary)

In `createRoom.handler`, before generating a code:

- `SELECT id, room_code FROM rooms WHERE host_session_id = $1 AND status != 'ended' ORDER BY created_at DESC LIMIT 1`.
- If a row exists, return `{ id, roomCode }` — do not insert.
- Otherwise fall through to the existing insert loop.

This means refresh / HMR / nav-back on `/host` reattaches to the live room and every joined player stays connected. No client changes needed for this.

### 2. Defensive client behavior on `/host`

Tiny follow-up so a player who joined the now-resumed room is visible right away:

- After `createRoomFn` resolves, if the returned `roomCode` differs from `loadHostSession().roomCode`, overwrite localStorage with the server's value (already the case) — keep this.
- Add a `toast.success("Resumed room {code}")` when the returned room id matches the prior host session, just so it's obvious in dev.

### 3. Join-page contrast polish (secondary, cosmetic)

The headless-browser screenshot of `/join` came back nearly blank. The DOM and text are there (verified via `observe`); it's a low-contrast-on-fallback-serif issue in the Fellowship theme while `Cormorant Garamond` / `EB Garamond` load. Two small changes in `src/routes/join.tsx`:

- Wrap the form inside a `bg-card border border-border rounded-3xl` container so inputs and labels sit on a slightly darker surface (uses existing tokens, no new colors).
- Bump the heading and helper text to `text-foreground` and `text-muted-foreground` explicitly instead of inheriting body color, and make the heading `font-display` so the visual hierarchy survives the fallback font.

No token edits — strictly presentational classes from the existing design system.

## Files touched

- `src/lib/rooms.functions.ts` — add resume branch in `createRoom`.
- `src/routes/host.tsx` — small toast on resume (optional).
- `src/routes/join.tsx` — contrast/container polish.

## Out of scope

- No schema changes (existing `rooms.host_session_id` + `status` columns are sufficient).
- No realtime / game-engine changes.
- No new dependencies.

## Verification after build mode

1. Open `/host` → note room code.
2. Join from a second tab.
3. Refresh `/host` → assert the same room code is shown and the player is still in the Players list.
4. Pick Music → Start game → confirm question stage renders on both host and player.
