## Current state

Every baked pool in `src/lib/host-persona.ts` already has **25 lines** (11 pools × 25 = 275 baked lines). The bottleneck for variety isn't the existing pools — it's that several "in-the-room" moments have no baked pool at all and fall back to a poorly-fitting one.

Live Tier-1 templates in `persona-live.ts` are also thin (4–7 per moment).

## Plan

### 1. Expand existing baked pools: 25 → 40 lines each
`src/lib/host-persona.ts` — add 15 fresh lines to each of the 11 existing moments:
`intro_hype`, `question_open`, `all_correct`, `all_wrong`, `split_correct`, `first_blood`, `streak_milestone`, `elimination`, `leader_changed`, `final_hype`, `credits_open`.

Tone guardrails (match existing Vox voice): under ~8 words, dry/snarky, no emojis, no player names, no apostrophe-heavy contractions that trip TTS.

### 2. Add 4 new baked pools for moments that currently borrow a wrong one
Extend the `Moment` union and `LINES` map with:

- `comeback` — generic "someone clawed back" (Tier 3 fallback for live comeback). 30 lines.
- `round_recap` — generic round-end zing when MVP can't be named. 30 lines.
- `idle_interject` — dead-air filler between questions ("Don't make me start humming."). 30 lines.
- `round_transition` — between-round stingers ("Round 2. Heating up."). 30 lines.

Update `FALLBACK_MOMENT` map in `src/lib/persona-live.ts` so `comeback` → `comeback` and `round_recap` → `round_recap` (currently they wrongly point at `first_blood` and `split_correct`).

### 3. Expand live Tier-1 templates in `persona-live.ts`
Bump every `TEMPLATES[...]` array from 4–7 lines to **10 lines each**. Update `LIVE_COUNTS` in `src/lib/host-moments.ts` to match so the admin panel shows the new counts.

### 4. Register new moments in the admin Sounds page
`src/lib/host-moments.ts` — add registry entries for `comeback`, `round_recap`, `idle_interject`, `round_transition` so they appear in the Host Moments panel with Preview buttons.

### 5. Re-bake
After the file edits, you click **🎭 Bake persona catchphrases** once. The bake server fn skips already-cached lines, so it only hits ElevenLabs for the ~165 new baked lines (~1 ElevenLabs request each, ~2–3 min total).

## Cost / scope

- ElevenLabs calls: ~165 new (one-time, then cached forever unless text changes).
- No DB changes, no gameplay logic changes, no new UI surfaces — admin panel auto-picks up new moments via the registry.

## Files

- Edit: `src/lib/host-persona.ts` (expand 11 pools, add 4 new pools, extend `Moment` union)
- Edit: `src/lib/persona-live.ts` (expand `TEMPLATES`, fix `FALLBACK_MOMENT` for comeback/round_recap)
- Edit: `src/lib/host-moments.ts` (update `LIVE_COUNTS`, add 4 new registry entries)

## Out of scope

- Wiring `idle_interject` / `round_transition` into actual gameplay triggers — this plan only writes the lines and bakes them. Hooking them into `HostGameStage` is a separate pass.
- Editing lines from the admin UI.
- Changing the Tier 1/2/3 cap.
