## Where the credits go today

Cache infra is already solid:
- 99% cache hit rate so far (383 hits / 4 generated)
- 363/363 question reads pre-baked
- Tier system caps personalized Vox lines at 30 per game, then falls back to baked catchphrases
- Per-game generation cap = 50 (in `TTS_CAP_PER_GAME` env, default)

**The real gap:** baked content coverage. The cache fills up *as games happen*, so the first time anyone hears a given catchphrase it burns credits.

| Pool | Total lines | Baked | Missing |
|---|---|---|---|
| Persona catchphrases (host-persona.ts, 18 moments) | ~720 | 30 | ~690 |
| DYK explanations | 363 questions | 140 | 220 |
| Round-number callouts ("Round 1! First question!", "Round 2!" … "Round 30!") | 31 | 0 | 31 |

Baking all of it now is cheap (~60k chars ≈ ~$2 of the new 1.8M budget) and makes every future game ~100% cache hits for the static lines.

## What I'll ship

### 1. Make `generatePersonaPack` idempotent and bake EVERYTHING
Right now it deletes the row and re-uploads every time it runs (re-burns credits for already-baked lines). Change it to:
- Skip lines whose `sound_clips` row already exists with a matching `storage_path` *and* whose audio file is present in storage.
- Add a `force?: boolean` input for forced re-bake.
- Insert a small `await sleep(150ms)` between calls (already does 200 — fine).

### 2. Add round-number callouts to the persona pack
Generate text variants once:
- `"Round 1! First question!"`
- `"Round 2!"` through `"Round 30!"`
- Plus the recap variants the host already says: `"Round ${n} incoming…"`

These get baked into the same persona cache, so `speakAsElf("Round 3!")` becomes a free URL hit.

### 3. New `bakeAllExplanationTTS` runner (server fn already exists per-question — add the bulk version)
Mirror of `bakeAllQuestionTTS`: select questions where `explanation IS NOT NULL AND explanation_tts_path IS NULL`, bake in a loop with 250ms delay, return `{baked, skipped, errors}`. Limit param up to 500.

### 4. Wire it into the admin TTS page (`/admin-tts`)
Add a "Pre-bake content" panel above the observability tables:
- **Persona pack** — shows "X / ~720 baked" with **Bake missing** and **Force re-bake all** buttons.
- **Question reads** — already 363/363; show "All baked ✓" or a Bake-missing button if drift.
- **DYK explanations** — shows "140 / 360 baked", **Bake missing** button.
- Each button calls the corresponding server fn, shows a progress toast, then reloads counts.

Also surface today's runtime cap (`TTS_CAP_PER_GAME`) with a note: "to change, update the env var" — I won't auto-bump it, since you mentioned you might downgrade later. Easy lever to pull yourself.

### 5. Small code-side glue
- `HostGameStage` already speaks `"Round ${n}!"` via `speakAsElf` — no change needed; the persona-cache map lookup happens by exact text, and once those strings are baked the call becomes free.
- Add the round-number string list to `host-persona.ts` (new exported `ROUND_CALLOUTS` array) so persona-pack baker picks them up generically.

## Out of scope

- Not changing the tier caps in `persona-live.ts` (15/30) — those control *personalized* lines, which by definition can't be cached.
- Not touching the per-room cap. Easy env knob; leaving it to you.
- Not pre-baking name-prefix lines like `"Sarah!"` — names are unknowable until players join, and the tier-2 cache already handles repeats within a session.
- No DB schema changes. No new buckets. No new secrets.

## Estimated one-time cost to bake everything

- Persona pack (~690 new lines × ~35 chars) ≈ 24k chars
- Round callouts (~30 lines × ~15 chars) ≈ 0.5k chars
- DYK explanations (220 × ~150 chars) ≈ 33k chars
- **Total ≈ 58k chars ≈ ~3% of one month of your 1.8M budget**

After that, a typical game should burn near zero credits on static lines — only true personalized Tier-1 sentences (≤15 per game) generate.
