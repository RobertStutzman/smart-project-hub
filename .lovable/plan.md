
# Asymmetry Rounds — one per game, slot 8–17

A single "asymmetry round" fires per game in a random slot between Q8 and Q17 (never overlapping wildcard slots 10 or 15). It replaces that question with a player-driven mini-game: type-or-vote on phones, watch on the TV. Announcer explains the rules before it starts.

## The 4 formats

**1. Crowd-Pleaser** — TV shows a subjective prompt ("Most overrated movie of all time"). Players type a one-line answer on their phone (20s, 80 chars). Submissions appear on TV anonymized, then everyone votes for the best one (10s). Top vote-getter: +400. Runner-up: +200. The author of the winning answer is revealed at the end with a spotlight.

**2. Two Truths & a Lie** — One player is picked as "the source" (rotates each game so the same person isn't always chosen). They get a private prompt template on their phone ("Two true things and one lie about yourself") and submit 3 statements (30s). Everyone else sees the three statements on TV in random order and votes which is the lie (15s). Correct guess: +250 per guesser. Source earns +150 per player they fooled.

**3. Hot Take Defense** — TV shows a polarizing statement ("Pineapple belongs on pizza"). Players tap AGREE or DISAGREE (8s). The minority side gets +300 each for being brave; majority gets +50 consolation. Ties: everyone +150. Announcer reads the split dramatically.

**4. Finish The Sentence** — TV shows a setup ("____ would instantly ruin a first date"). Players type endings (20s, 60 chars). Room votes funniest (10s). Scoring identical to Crowd-Pleaser.

## When it fires

- On game start, pick a random integer in `[8, 17]` excluding `{10, 15}`, seeded from `room.id` so it's deterministic per game.
- Pick one of the 4 formats from a shuffled deck (also seeded from room.id) so each game gets a different vibe.
- Store both on the room. When `question_index` hits the chosen slot, branch into the asymmetry flow instead of pulling a trivia question.

## Question source

Hand-authored seed list of **60 prompts** split across formats (15 each), stored in a new table `asymmetry_prompts` with columns `id, format, prompt, created_at`. Picked at random per game, scoped to the chosen format. No AI cost, fully deterministic.

Example seeds:
- Crowd-Pleaser: "Most overrated band of all time?", "Worst pizza topping?", "Most useless kitchen gadget?"
- Hot Take: "Cereal is a soup.", "Socks with sandals should be legal.", "Die Hard is a Christmas movie."
- Finish The Sentence: "____ is the worst thing to hear from your dentist.", "Never trust a person who ____."
- Two Truths: prompt template is fixed — the player invents the statements.

## Technical implementation

### Database (one migration)

```sql
-- New phases the room can enter for asymmetry rounds
-- (no enum — phase is text; just new accepted values: 'asym_intro', 'asym_submit', 'asym_vote', 'asym_reveal')

ALTER TABLE public.rooms
  ADD COLUMN asym_slot_index integer,           -- which Q# the round fires on (8–17)
  ADD COLUMN asym_format text,                  -- 'crowd_pleaser' | 'two_truths' | 'hot_take' | 'finish_sentence'
  ADD COLUMN asym_prompt text,
  ADD COLUMN asym_source_session_id text,       -- for two_truths
  ADD COLUMN asym_submissions jsonb,            -- [{ session_id, text, votes }]
  ADD COLUMN asym_phase_started_at timestamptz;

ALTER TABLE public.players
  ADD COLUMN asym_submission text,              -- their typed answer (or "1|0" agree/disagree)
  ADD COLUMN asym_vote_target text;             -- session_id or submission idx they voted for

CREATE TABLE public.asymmetry_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL,
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asymmetry_prompts TO authenticated, anon;
GRANT ALL ON public.asymmetry_prompts TO service_role;
ALTER TABLE public.asymmetry_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asym_prompts_select_all" ON public.asymmetry_prompts FOR SELECT USING (true);

-- Seed 60 rows (15 per format) inline in the same migration.
```

### Server (`src/lib/game.functions.ts` + new `asymmetry.functions.ts`)

- New helper `pickAsymmetrySlot(roomId)` — seeded pick from `[8,9,11,12,13,14,16,17]`.
- New helper `pickAsymmetryFormat(roomId)` — seeded pick from the 4 formats.
- In the "advance to next question" flow: if `next_index === room.asym_slot_index`, call `startAsymmetryRound` instead of `startQuestion`.
- `startAsymmetryRound`: load a random prompt for the chosen format, set `phase='asym_intro'`, fire announcer explainer (7s pad like wildcards), then transition to `asym_submit`.
- `submitAsymAnswer({ text | choice })`: validated server fn (Zod, length-limited), writes to `players.asym_submission`. Server auto-advances to `asym_vote` when all players have submitted OR the timer expires.
- `submitAsymVote({ targetSessionId })`: writes to `players.asym_vote_target`. Auto-advance to `asym_reveal` when all in OR timer expires.
- `finalizeAsymmetryRound`: tallies votes, awards points per the format's rules, sets `phase='reveal'` to plug back into the existing reveal/next-question pipeline.

### Announcer

Add `ASYM_EXPLAINERS` in `src/lib/wildcards.ts` (or new `asymmetry.ts`) — 2 lines per format, picked randomly. Same `speakAsElf(..., { interrupt: false })` FIFO pattern already used for wildcard explainers.

### UI

**Host TV** — new `src/components/host/AsymmetryStage.tsx` with sub-views per phase:
- `intro`: big format badge + prompt + animated rules
- `submit`: prompt + "waiting on X of Y players…" with avatar ticks
- `vote`: anonymized submissions in a grid, live vote count
- `reveal`: winner spotlight, points popping, author reveal

**Player phone** — new `src/components/play/AsymmetryPlay.tsx`:
- `submit` phase: text input (or A/D buttons for Hot Take, or 3 text inputs for Two Truths source)
- `vote` phase: tappable list of submissions (own submission disabled)
- `reveal` phase: shows their result + delta points

**Routing/wiring** — `HostGameStage.tsx` and `play.tsx` add a branch: when `room.phase` starts with `asym_`, render the asymmetry components instead of `QuestionStage`.

### Verification

1. Start a 20-question game → confirm exactly one asymmetry round fires in slot 8–17, never on 10/15.
2. Each of the 4 formats: confirm submit → vote → reveal flow, scoring, and announcer line.
3. Refresh mid-round: phase persists, timer continues from server `asym_phase_started_at`.
4. All players submit early → auto-advances without waiting full timer.
5. Two Truths: source's phone shows the 3-input form; everyone else shows "waiting on [name]…".
6. Inactive/disconnected player doesn't block phase advance (timer wins).

## Build order (suggested)

1. Migration + seed prompts
2. `asymmetry.functions.ts` (server logic, all 4 formats)
3. Wire slot selection into `startQuestion` flow
4. Host `AsymmetryStage` (one phase at a time, start with Crowd-Pleaser)
5. Player `AsymmetryPlay`
6. Announcer explainers
7. Other 3 formats (mostly reuse same components with conditional rendering)
8. QA pass: full game with each format forced via dev override
