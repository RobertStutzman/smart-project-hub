## Restart-game bug fix

When the host hits "Play again" in Credits we currently just flip `rooms.phase = "lobby"` and leave everything else in place. That leaves last game's `current_category` ("Movies: Sci-Fi") on the room, leaves `current_question_id`, `round_number`, `score`, `current_round_score`, `streak_count`, etc. on the players, and leaves `room_questions` (used-question history) intact. The leftover category renders the extra "Category: …" line in the lobby hero, which crowds the QR / player row layout and collides with the player chip the user saw "stacked on top."

### 1. New server fn: `restartGame` (`src/lib/game.functions.ts`)
- Host-authed (same auth pattern as `setPhase` / `startFinalRound`).
- In one handler, for the host's room:
  - `rooms` update: `phase = "lobby"`, `round_number = 0`, `current_question_id = null`, `current_category = null`, `current_explanation_tts_url = null`, `question_started_at = null`, `current_question_locked_count = 0` (whichever of these columns exist — match the schema used in `nextQuestion`/`startFinalRound`).
  - `players` update (room-scoped): `score = 0`, `current_round_score = 0`, `current_round_fastest = false`, `streak_count = 0`, `best_streak = 0`, `last_answer_correct = null`, `current_answer = null`, `final_wager = 0`, `final_answer = null`, `final_locked_at = null`, `comeback_bonus = false`. Keep `nickname`, `avatar_url`, `team`, `is_audience`, `session_id` (so the same players stay in the lobby).
  - `room_questions` delete where `room_id = room.id` (so questions don't repeat on the new game).
- Keep `allow_late_joiners` and `enabled_categories` as-is (host's picker selections are a session preference, not per-game).

### 2. Wire `onPlayAgain` to the new fn (`src/components/host/HostGameStage.tsx`)
- Replace the `setPhaseFn(... "lobby")` call inside the `credits` branch's `onPlayAgain` with `restartGameFn({ data: { roomCode, hostSessionId } })`.
- Import + `useServerFn(restartGame)` at the top of the component alongside the other server-fn hooks.
- `WinnerSpotlight`'s "Roll credits" path is unchanged — restart only happens from Credits → Play Again.

### 3. Defensive local-state clear (`src/routes/host.tsx`)
- In the realtime `rooms` subscription handler, the realtime `UPDATE` will carry the new `current_category = null` and `round_number = 0` and the existing code already mirrors those into local state, so no extra wiring is needed.
- The visual "player stacked on top of category" symptom disappears as a side effect of `current_category` being cleared (the extra hero line goes away, the layout reflows). No CSS changes planned — if it still overlaps after the data fix we can address layout in a follow-up.

### Out of scope
- No changes to `setPhase` itself; existing transitions stay untouched.
- No changes to the in-lobby category picker, leaderboard, ambience, or audio.
- Host's `enabled_categories` selection is preserved across restart (intentional — re-picking categories every game is friction).

### Technical notes
- Use `supabaseAdmin` from `@/integrations/supabase/client.server` like the other handlers in `game.functions.ts`.
- Reuse the `getRoomByHost(roomCode, hostSessionId)` helper for auth; that's the project's standard pattern in this file.
- Player updates use `.eq("room_id", room.id)` — single statement, no per-row loop.
- `room_questions` delete is a single `.delete().eq("room_id", room.id)`.
