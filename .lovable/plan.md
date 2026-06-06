## Final Round — Wager Mode

After round 15's leaderboard, instead of going straight to "Game over", the game enters a special final round modelled on Final Jeopardy: a big splash, secret wagers, one question, dramatic reveal.

### Flow

```text
round 15 leaderboard
   └─ host clicks "Start Final Round"
        ├─ phase: final_intro       (5s animated splash on host + player)
        ├─ phase: final_wager       (~20s: each player picks 0–their_score)
        ├─ phase: final_question    (25s timer, NO answer drops, NO 2x, NO glitch)
        ├─ phase: final_reveal      (correct answer shown + per-player wager/result)
        └─ phase: ended             (winner + roast, as today)
```

### Rules

- **Eligibility:** all non-audience players with score > 0. Score-zero players play along but can only wager 0.
- **Wager:** integer slider 0 → current score. Default 0 if they don't submit by the timer.
- **Question:** pulled from the same category as the game (or random if exhausted). Marked as used so it isn't repeated.
- **Scoring:**
  - Correct → score += wager
  - Wrong / no answer → score −= wager (floor at 0)
  - No streak bonus, no rubber-band, no 2x, no fastest bonus — just the wager.
- **Wagers are hidden** from everyone until reveal (then shown on each player's row).

### Host stage

- New leaderboard button (only when round_number ≥ 15): **"Start Final Round"** instead of today's "End game".
- `final_intro`: full-screen splash — "FINAL ROUND" in display font, gold gradient, animated grain, music sting (reuse existing `play("whoosh")` + start a tense music bed). Auto-advances after 5s.
- `final_wager`: shows the top-3 standings on the left, big "Players are placing their wagers…" with a live count of submitted/total on the right, 20s countdown.
- `final_question`: standard QuestionStage but with a gold border, 25s timer, NO drop animations.
- `final_reveal`: each player card shows `wager → +wager / −wager → new score`, sorted by new score. After ~6s, auto-advance to `ended`.

### Player stage

- `final_intro`: same splash, smaller.
- `final_wager`: slider 0 → my score, big "Lock wager" button. Once locked, shows "Wager locked: 350" and waits.
- `final_question`: normal AnswerGrid, NO 2x button, NO glitch button.
- `final_reveal`: shows my wager, whether I was right, and my new score with a big delta.

### Technical notes

- **DB migration** on `players`:
  - `final_wager integer NOT NULL DEFAULT 0`
  - `final_answer integer` (nullable)
  - `final_locked_at timestamptz` (nullable)
- **DB migration** on `rooms`:
  - Add `'final_intro' | 'final_wager' | 'final_question' | 'final_reveal'` to the phases the app uses (column is `text`, so no enum change — just update the `setPhase` zod enum in `game.functions.ts`).
- **New server fns** in `src/lib/game.functions.ts`:
  - `startFinalRound({roomCode, hostSessionId})` → sets phase `final_intro`, resets `final_wager / final_answer / final_locked_at` for all players, picks + stores the final question on the room (`current_question_id / text / answers / correct_index`).
  - `advanceFinalPhase({roomCode, hostSessionId, to})` → host-driven phase bumps (`final_wager`, `final_question`, `final_reveal`, `ended`); used by the auto-timers on the host.
  - `submitWager({roomCode, sessionId, wager})` → validates `0 ≤ wager ≤ current score`, stores on player.
  - `lockFinalAnswer({roomCode, sessionId, answerIndex})` → mirrors `lockAnswer` but writes `final_answer`.
  - `scoreFinalRound({roomCode, hostSessionId})` → runs at the end of `final_question`: applies wager scoring, writes per-player deltas into `current_round_score` so the reveal UI can show them, then moves room to `final_reveal`.
- **Host orchestrator** (`HostGameStage.tsx`) gets timers for the three auto-advance steps (intro 5s → wager 20s → question 25s → reveal 6s → ended) and skips all the drop / 2x / saboteur / glitch logic during final phases.
- **Player view** (`play.tsx`) branches on the new phases: wager slider, plain answer grid, reveal card.
- **AI roast** already runs on `ended`, so it just keeps working.

### Out of scope

- Comeback mechanic for score-zero players (they can still answer for 0).
- Multiple final questions (locked at 1 per your pick — easy to extend later).
- Audience wagering.
