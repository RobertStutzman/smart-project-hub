# All 10 wildcards + announcer pre-explainer

## Cadence (unchanged)
Wildcards fire on **Q5 / Q10 / Q15 / Q20**. Per game I shuffle a 10-deep deck and deal the first four cards into those slots — no repeats within a game, fresh order every game.

The deck: `lightning, double_or_nothing, first_blood, underdog, saboteur, glitch, roast, sudden_drop, mirror, heist, blackout` (11 total; I'll keep the original 7 + drop the weakest if you want — see "Open question").

## Pre-question announcer explainer

For every wildcard round, before the question is read, the announcer says a punchy 1-2 sentence rules line. Routed through the existing Elf-voice FIFO queue so it's guaranteed to play first, then the question read follows automatically.

### Files
- **`src/lib/wildcard-explainers.ts` (new)** — map of `wildcard → explainer line(s)`. Multiple variants per type, picked randomly. Examples:
  - `lightning`: "Lightning round! Eight seconds on the clock, double points for the brave."
  - `sudden_drop`: "Sudden Drop. Only two answers tonight — fifty-fifty, no excuses."
  - `heist`: "Heist round. Get this right and you steal fifty points straight off the leader."
- **`src/components/host/HostGameStage.tsx`** — in the existing "play question TTS" effect, if `state.wildcard` is set, `await speakAsElf(explainer, { interrupt: false })` *before* `playVoiceUrl(questionUrl, { interrupt: false })`. Switch the question read from `interrupt: true` → `interrupt: false` so the explainer can't be trampled.
- **`src/lib/game.functions.ts`** — for wildcard rounds, push `question_started_at` from `now + 6000` to `now + 13000` so the on-screen countdown doesn't start until the explainer + question read have had time to play.

## The 4 new wildcards

### `sudden_drop`
- Server picks one wrong index and writes it into `dropped_indexes` at question creation. Only 2 tiles visible from the start.
- `question_duration_ms = 12000`. Scoring multiplier ×1.5 on a correct lock.
- WildcardBanner entry added with ⚠️ icon and "Two answers · 1.5×".

### `mirror`
- Server tags the room with `wildcard: "mirror"`. Client visual transform only — `QuestionStage` reverses the answer tile order (D / C / B / A) when wildcard is mirror, and the letter labels rendered on each tile come from a shuffled `["A","B","C","D"]`.
- Lock-in still binds to the answer text, not the position, so scoring is unchanged and fair.
- Standard 25s timer, standard scoring.

### `heist`
- Same as a normal question for question selection/display. Scoring change in `endQuestion`:
  - For each player who locks correct, compute their normal earned points, then *also* subtract 50 from the current leader's score (single subtraction per round, not per correct player — first correct picks the steal target). Apply at the end after all base scoring.
  - Edge case: if you ARE the current leader and you get it right, you defend (no self-steal, no bonus).
- WildcardBanner: 💰 "Steal 50 from the leader".

### `blackout`
- Server tags `wildcard: "blackout"`. Client (`QuestionStage`) hides `questionText` for 5 seconds after the read starts (audio plays normally), then fades the text in. Answers visible the whole time.
- Standard timer + scoring.

## Activating dormant 3

Saboteur, Glitch, Roast are already coded. They join the shuffled deck. No mechanic changes; just additional `WildcardBanner` polish (already present) and explainer lines.

## Verification
- Play a full game; confirm all four wildcard slots fire distinct types each run.
- For each wildcard, the explainer plays first, then the question, with no overlap and no clipped audio.
- Sudden Drop shows 2 tiles. Mirror reverses tile order. Heist subtracts from leader on correct. Blackout hides text for 5s.

## Open question
The deck has 11 entries (7 original + 4 new) but only 4 slots per game. Want me to:
- (a) keep all 11 and just shuffle, or
- (b) drop one of the weaker existing ones (e.g. `glitch`, which is purely a visual gag with no scoring stakes)?

I'll default to (a) unless you say otherwise.
