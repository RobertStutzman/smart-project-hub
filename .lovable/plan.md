## Problem

`restartGame` in `src/lib/game.functions.ts` (lines ~1431–1435) deletes every row in `room_questions` for the room when the host hits Play Again. That wipes the per-room "already asked" filter, so the next game can re-serve questions the same audience just saw. The global `questions.times_used` rotation is still in place (working — 1227/1415 questions remain unused), but it only soft-prefers fresh ones; with narrow category sets or after multiple replays, a recent question can resurface.

## Fix

Remove the `room_questions` wipe in `restartGame`. Per-room "asked" history then accumulates across replay sessions, so `pickQuestion` / final-round / wildcard pickers all keep excluding previously-asked IDs via the existing `not("id", "in", ...)` filter. Behavior:

1. **`src/lib/game.functions.ts`** — delete the `await supabaseAdmin.from("room_questions").delete().eq("room_id", room.id);` block (and the comment above it) inside `restartGame`.
2. No schema changes; no other functions change. The fallback chain in `pickQuestion` already handles "pool ran dry" by dropping the category constraint, so a long-lived room with hundreds of asked questions still gets fresh ones until the entire pool is exhausted, at which point the existing `exhausted: true` path ends the game cleanly.

## Verification

- Open `/host`, play a short game, hit Play Again, play another — confirm no question repeats across the two games on the host TV.
- Run `SELECT COUNT(*) FROM room_questions WHERE room_id = '<room>'` before and after a restart — count should grow, not reset.
- Narrow `enabled_categories` to one small category (~20 questions), play through and restart — game should keep serving fresh questions until the pool is exhausted, then end gracefully instead of looping.

## Out of scope (call out, don't build)

Cross-room repeats (same friends, new room code) still rely on the soft global `times_used` rotation, which is sufficient given 1227 never-used questions today. A stricter per-host or per-player ignore list would be a separate change.

## Files

- `src/lib/game.functions.ts` — single 5-line deletion inside `restartGame`.
