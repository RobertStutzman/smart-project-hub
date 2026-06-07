# Premium Showmanship Pass

A staged build that turns the game from "trivia with FX" into a hosted show. Grouped into 4 phases so each can ship and be tested independently. Each phase is playable on its own — you can stop after any phase.

---

## Phase 1 — The Show Wrapper (no scoring changes)

Pure presentation. Zero risk to existing scoring or game flow.

1. **Cold Open / Hype Intro**
   - New phase `intro` inserted between `lobby` → first `question`.
   - 8–10s sequence on host screen: animated title card → "Tonight's contestants" roster with avatars sliding in → category preview → "GO" stinger.
   - Reuses existing TTS announcer for the voiceover; reuses sound slots.
   - Skippable by host (Space).

2. **Host Persona with Catchphrases + Wrong-Answer Reactions**
   - One JSON file: `src/lib/host-persona.ts` — name ("Vox", "Chip", whatever), 6–8 catchphrases per moment (intro, correct, wrong, streak, elimination, comeback, final).
   - Hook into existing reveal phase: when `current_correct_index` resolves, pick a line based on what happened (everyone wrong → snark line; first-blood streak → hype line) and pipe through the existing TTS bake pipeline.
   - Lines are pre-baked at admin time (like questions) so playback is zero-lag.

3. **Last-Place Roast by Name**
   - On every `leaderboard` phase: pick bottom player, generate a 1-sentence roast via existing `AIRoast`/announcer pipeline using their nickname + their wrong answers that round.
   - Already have `roast_candidates` JSONB on rooms — extend to include "biggest goof of the round" so the roast can reference a specific wrong answer.

4. **Outro Credits Roll**
   - New phase `credits` after `ended`.
   - Scrolling credits: winner card → "Cast" (every player avatar + nickname + final score) → "Funniest Moments" (auto-picked from stats: biggest comeback, most confident wrong, fastest finger, longest streak) → "Directed by Vox."
   - Music swells, plays for ~25s, then "Play Again" CTA.

**Schema:** Add `'intro'`, `'credits'` to the `setPhase` enum and any DB phase check.

---

## Phase 2 — Round Themes + Commercial Breaks

Introduces variety without changing core scoring math.

5. **Round Themes**
   - New column `rooms.round_theme text` (nullable).
   - 4 themes to start:
     - **Lightning** — timer halved (7s), points doubled
     - **Sudden Death** — wrong answer = 0 points for the round (no streak reset penalty stacking)
     - **Double Points** — flat 2× on the round
     - **Wildcard** — random category, can't be skipped
   - Theme is picked at the start of each new round (round 2, 3, …) with a "ROUND THEME" reveal card before the first question.
   - Visual treatment per theme: tinted vignette, alt timer ring color, themed stinger sound.

6. **Commercial Breaks**
   - Every 5 rounds, new phase `commercial` (15s).
   - Three rotating gag spots: fake sponsor (e.g. "Vox-Cola"), "Tonight's MVP so far" stat card, "Did you know" trivia fact pulled from the question pool's `explanation` field.
   - Host can skip with Space; players see a "BRB" screen on `/play`.

**Schema:** `rooms.round_theme text`, optional `rooms.commercial_index int`.

---

## Phase 3 — Streak Bonuses, Power-ups, Categories Draft

Scoring-and-strategy layer. This is the biggest single phase — touches `game.functions.ts` scoring.

7. **Tiered Streak Bonuses (upgrade existing 1.1×)**
   - Current: 3+ correct = 1.1×.
   - New tiers: 3=1.25×, 5=1.5×, 7=2×. Visible "🔥 STREAK x5" badge on player + host overlay. "ON FIRE" stinger at 5+.
   - Touches `STREAK_BONUS` math in `game.functions.ts` lines ~390.

8. **Power-ups (expand beyond 2×)**
   - Each player gets 3 power-ups for the whole game, one of each:
     - **50/50** — eliminate 2 wrong answers visually for that player only
     - **Freeze** — lock another player out of the next question (target picked from leaderboard)
     - **Shield** — protect your streak from one wrong answer
   - Existing `used_2x`/`pending_2x` columns become a pattern: `used_5050 bool`, `used_freeze bool`, `used_shield bool`, plus `pending_*` versions.
   - UI: power-up tray on `/play` between rounds; targeted picker for Freeze.

9. **Categories Draft**
   - Between rounds, new mini-phase `category_draft` (15s).
   - Bottom 3 players each get to veto one category; remaining player from top half picks the next category from what's left.
   - Rubber-band mechanic: keeps last-place engaged. Optional toggle in lobby.

**Schema:**
- `players`: add `used_5050`, `used_freeze`, `used_shield`, `frozen_for_round_id` (uuid nullable).
- `rooms`: add `category_veto jsonb`, `next_category text`.

---

## Phase 4 — Team Mode + Bluffing Round

Game-mode-level additions. Larger surface area; ship last.

10. **Team Mode**
    - Lobby toggle. When on, players join Team A / Team B (or auto-assigned).
    - `players.team text` (nullable, 'A' | 'B').
    - Scoring: individual lock-ins still happen, but the round score for each team = sum of its players' scores. Leaderboard shows team totals first, individual contributions second.
    - Final round becomes one team-wager (captain picks). Captain = highest scorer on each team.

11. **Bluffing Round (Psych-style)**
    - New question type `bluff` (just a `type text` column on `questions` defaulting to `'mcq'`).
    - For bluff questions, only the **prompt** is stored — no answers. Flow:
      - 20s: players type a fake answer on `/play`
      - 5s: real answer + all submitted fakes are shuffled and shown
      - 15s: players vote on which is real
      - Reveal: +500 for picking real, +300 for each player who picked your fake
    - New phases: `bluff_write`, `bluff_vote`, `bluff_reveal`.
    - New table `bluff_submissions` (room_id, question_id, player_id, text, votes_received int).

**Schema:**
- `players.team text`, `players.is_captain bool`.
- `questions.type text default 'mcq'`.
- New `bluff_submissions` table (with GRANTs + RLS).

---

## Suggested ship order

I recommend shipping in this order and stopping for your feedback after each:

1. **Phase 1** (show wrapper) — most "premium" feel for least risk; pure additive.
2. **Phase 2** (themes + breaks) — huge variety bump, small scoring touch.
3. **Phase 3** (streaks + power-ups + draft) — strategy depth.
4. **Phase 4** (teams + bluffing) — new game modes.

---

## Technical notes (for reference)

- All new phases go through existing `setPhase` server fn — extend the Zod enum.
- All host-persona + roast TTS goes through existing `announcer.functions.ts` + bake pipeline; no new audio infra.
- Round themes, power-ups, draft, teams, bluffing all need DB migrations with the standard `GRANT` + RLS block per project rules.
- Bluffing requires a new realtime-subscribed table; will follow the same pattern as `players` (public read, server-fn writes).
- No edge functions needed — everything fits in `createServerFn`.

---

**Confirm:** Ship Phase 1 first, or do you want to reorder / cut anything?
