Ship in three independent slices. Each slice can be tested before moving on, but I'll write them as one continuous change since they don't conflict.

## Slice 1 — Glitch round visuals (small)

**Leader phone (already partially there):** strengthen the existing scramble visual in `src/routes/play.tsx`. Replace the single blur+hue-rotate with layered RGB-split (two offset cyan/magenta clones via CSS `text-shadow` on the grid), scanline overlay (repeating-linear-gradient), and a per-100ms `transform: translate(±2px, ±1px)` jitter driven by a small interval. Keep the 5s `glitch_active_until` window.

**Host stage:** when `glitch_active_until` is in the future, the `HostGameStage` question route renders a full-screen overlay above `QuestionStage`:
- 5s screen-tear flash (3 horizontal bands sliding at different speeds with chromatic shift)
- Tile labels on the host's `QuestionStage` get an extra `[A-D]` letter-flip animation (random letters cycling for 600ms then snapping back) so the room sees "the screen glitched"
- A small fuchsia chyron: "Glitch fired — {leaderName}'s screen is scrambled"

Implementation:
- New file `src/components/host/GlitchOverlay.tsx` — pure CSS animation, takes `activeUntil` + `leaderName`.
- Mount in `HostGameStage` next to the lightning overlay (line ~1394 area).
- No DB changes.

## Slice 2 — Final intro cinematic (medium)

Replace the static "Final Round" splash (HostGameStage lines 1556–1581) with a multi-beat sequence in a new `src/components/host/FinalIntroStage.tsx`:

1. **t=0** dark fade-in, "And now…" eyebrow (already-baked TTS-style line via `speakPersona`).
2. **t=0.8s** "3rd place" → avatar slides in from left + name pops, sting (`play("tick")` or `cymbal-swell`).
3. **t=2.6s** "2nd place" → from right, louder sting.
4. **t=4.6s** "1st place — your leader" → centered, scale-in, drumroll loop fades up, name spoken.
5. **t=7.2s** drumroll cuts → "FINAL ROUND" giant title scale-in with `final_sting`, hold 2s.
6. **t=9.5s** crossfade out, parent flips to `final_wager`.

Wire-up:
- `HostGameStage`'s timer effect at line 1134 currently flips to `final_wager` at 4500ms. Bump to ~9800ms and gate on the new component's `onDone` (use a ref the component fires).
- Speech: drop the existing 2000ms `speakAboutPlayer(final_showdown)` (line 1074) since `FinalIntroStage` now owns per-place speech.
- Falls through to `FinalWagerStage` as today.

No DB changes. Uses existing `final_sting.mp3` and `drumroll-build.mp3` assets (already in the manifest).

## Slice 3 — Asymmetry full loop, all 4 formats (large)

### Phase model

Replace single `asym_intro` auto-advance with a state machine:

```
asym_intro  →  asym_submit  →  asym_vote  →  asym_reveal  →  (nextQuestion)
```

Each phase is a value of `rooms.phase`. No new enum — `phase` is text.

### Schema

Single migration adds nothing new structurally (columns exist) but documents the JSON shapes:

- `asym_source_session_id` — used by `two_truths` only (the liar).
- `asym_submissions` — `{ [sessionId]: { text?: string, choice?: "agree"|"disagree"|0|1|2 } }`
- New column `asym_votes jsonb` — `{ [voterSessionId]: votedForSessionId | choiceIndex }`
- New column `asym_phase_ends_at timestamptz` — server-set deadline for the current asym phase (drives both client countdown and the auto-advance on the host).

Migration also grants the column to `authenticated`/`service_role` (rooms table already publicly selectable).

### Server functions (in `src/lib/game.functions.ts`)

All accept `{ roomCode, sessionId }` and check the room is in the expected phase.

- `startAsymRound(roomCode, hostSessionId)` — flips `asym_intro` → `asym_submit` after intro. Sets deadline (45s for text formats, 12s for `hot_take`). For `two_truths`, picks `asym_source_session_id` deterministically by `(round_number, room.id)` hash over live players.
- `submitAsymEntry(roomCode, sessionId, payload)` — validates payload shape per `asym_format`, merges into `asym_submissions`. For `two_truths` only the source may submit (three statements in `payload.statements: string[3]` + `payload.lieIndex: 0|1|2`). For `hot_take` everyone picks `agree|disagree`. For `crowd_pleaser` / `finish_sentence` everyone submits `text` (≤120 chars).
- `startAsymVote(roomCode, hostSessionId)` — `asym_submit` → `asym_vote`. Sets 20s deadline. For `hot_take` skipped — goes straight to `asym_reveal`.
- `submitAsymVote(roomCode, sessionId, vote)` — records into `asym_votes`. Voters can't vote for themselves. For `two_truths`, vote is the lie-index guess (0|1|2). For text formats, vote is the submitter's `sessionId`.
- `startAsymReveal(roomCode, hostSessionId)` — tallies scores:
  - **crowd_pleaser / finish_sentence**: winner = most votes; +300 to winner, +100 to runner-up (>0 votes).
  - **two_truths**: each correct guesser +200; source gets +100 per fooled voter, capped at +600.
  - **hot_take**: minority side +400, majority +0 (ties → both +150).
  Writes to `players.score` and `players.current_round_score`. Flips phase to `asym_reveal`.
- `finishAsymReveal(roomCode, hostSessionId)` — clears asym_* state, calls `nextQuestion` internally.

Server-side auto-advance: the existing `host-heartbeat` style polling isn't there for asym. Instead, host-side `useEffect` watches `asym_phase_ends_at` and calls `startAsymVote` / `startAsymReveal` when the deadline passes, gated by a ref so only the host fires.

### UI

**Player (`src/routes/play.tsx`)** — new branch in render switch:

- `asym_intro` — shows the format card + "Get ready…"
- `asym_submit` — format-specific input:
  - text formats: `<textarea maxLength={120}>` + Submit button → calls `submitAsymEntry`
  - `hot_take`: two giant buttons "Agree" / "Disagree"
  - `two_truths`: if I'm the source, three text inputs + a "this is the lie" radio. Others see "{Name} is writing their statements…"
- `asym_vote` —
  - text formats: list of submissions (anonymized labels A/B/C…), tap to vote.
  - `two_truths`: three statements, pick which is the lie.
- `asym_reveal` — show scoreboard delta animation.

**Host (`src/components/host/HostGameStage.tsx`)** — new render branches for each asym phase:

- `asym_intro` — keep existing splash, but replace the 11s `setTimeout` → `nextQuestion` with `setTimeout` → `startAsymRoundFn` (8s). Speak the existing `pickAsymExplainer` line.
- `asym_submit` — full-bleed prompt card + live "X / Y players submitted" counter + countdown to deadline.
- `asym_vote` — show submissions in big cards (or statements for two_truths) with vote counts ticking.
- `asym_reveal` — winner spotlight: top submission centered, "+points" floating from each voter avatar, sting, then auto-advance via `finishAsymRevealFn` after 6s.

New components:
- `src/components/host/AsymSubmitStage.tsx`
- `src/components/host/AsymVoteStage.tsx`
- `src/components/host/AsymRevealStage.tsx`

### Test

- `bun run build` clean.
- Manual: start a game with 3 fake players, force `round_number` past asym slot, walk through each format end-to-end via /admin or by clicking through.

## Order of execution

1. Slice 1 (glitch overlay) — ~5 files touched, no DB.
2. Slice 2 (final intro) — 2 files + new component.
3. Slice 3 (asymmetry) — migration + ~6 server fns + 4 new components + edits to play.tsx and HostGameStage.tsx.

Build verification after each slice.
