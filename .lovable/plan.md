# Expand Adult VOX to 2,000+ Lines + Female Co-host

## Scope

- Grow the adult persona pool to **2,000+ raunchy lines** across all 19 moments (funny, rude, dirty, flirty).
- Add a **sultry female co-host** ("Sasha") who interjects on ~10-15% of moments using Jessica (ElevenLabs voice `cgSgspJ2msm6clMCkdW9`).
- Wire her voice into the TTS pipeline, cache, and bake system without breaking the existing standard/adult toggle.

## Content generation

### 1. Big raunchy pool expansion — `src/lib/host-persona.adult.ts`

Grow `BASE_LINES_ADULT` and/or add a new `EXTRA_LINES_ADULT_XL` layer so every moment reaches a target size. Targets (per moment):

| Moment | Current base | Target | New lines |
|---|---|---|---|
| intro_hype | 45 | 130 | +85 |
| question_open | 45 | 130 | +85 |
| all_correct | 45 | 110 | +65 |
| all_wrong | 44 | 130 | +86 |
| split_correct | 45 | 110 | +65 |
| first_blood | 45 | 110 | +65 |
| streak_milestone | 45 | 110 | +65 |
| elimination | 45 | 150 | +105 |
| leader_changed | 45 | 100 | +55 |
| final_hype | 45 | 120 | +75 |
| credits_open | 45 | 100 | +55 |
| comeback | 35 | 90 | +55 |
| round_recap | 35 | 90 | +55 |
| idle_interject | 35 | 130 | +95 |
| round_transition | 35 | 90 | +55 |
| wooden_spoon | 24 | 90 | +66 |
| goose_egg | 19 | 80 | +61 |
| last_to_lock | 13 | 70 | +57 |
| random_jab | 13 | 90 | +77 |

Total after merge with existing flirty extras: **~2,030 male-host lines** (before `{flirtName}` bake expansion, which multiplies flirty variants ~15x).

Content style: profanity, sexual innuendo, drinking jabs, walk-of-shame gags, dating-app burns, hangover cracks, college-party callbacks. Stays inside the current safety guardrails (no slurs, no minors, no non-consent).

### 2. New female co-host pool — `src/lib/host-persona.sasha.adult.ts`

New file with `LINES_SASHA_ADULT: Partial<Record<Moment, string[]>>` — she doesn't need every moment; she interjects on the fun ones:

- `elimination` (30), `all_wrong` (30), `wooden_spoon` (25), `goose_egg` (20), `streak_milestone` (25), `first_blood` (25), `random_jab` (30), `idle_interject` (30), `intro_hype` (20), `credits_open` (20), `comeback` (20), `leader_changed` (15), `final_hype` (15).

Persona: sultry, teasing, flirts back at male-coded names via `{flirtGuyName}` token (Chad, Tyler, Josh, Brad, etc.), mocks bad answers, purrs at streaks. Total: **~300 female lines**.

Grand total: **~2,330 unique adult lines** rotating.

## Voice + selection wiring

### 3. Add second voice ID — `src/lib/announcer.functions.ts`

- Add `FEMALE_ADULT_VOICE_ID = "cgSgspJ2msm6clMCkdW9"` (Jessica).
- Extend the `voice` enum from `"standard" | "adult"` → `"standard" | "adult" | "adult_female"`.
- Update `generateTTS` voice selector to route `adult_female` → Jessica.
- Update `hashTtsKey` to prefix `adult_female::` so cached files never collide with male adult.

### 4. Interjection selector — `src/lib/host-persona.ts`

In `pickLine` (currently 786-810), when adult mode is on:

1. Roll `Math.random() < 0.125` (12.5%).
2. If roll wins AND `LINES_SASHA_ADULT[moment]` exists → pick from her pool, tag the returned value with `{ text, voice: "adult_female" }`.
3. Otherwise → existing male adult path, tag `{ voice: "adult" }`.
4. Return type changes from `string` → `{ text: string; voice: "standard" | "adult" | "adult_female" }`. Update all call sites (announcer speak fns) to pass `voice` through to `generateTTS` / cache lookup.

Add a new token `{flirtGuyName}` handled the same way `{flirtName}` is, sourced from a new `ADULT_FLIRT_GUY_NAMES` list in the sasha file.

### 5. Bake pipeline — `src/lib/announcer.functions.ts`

- Extend `generatePersonaPackAdult` to iterate the male pool (as today) **plus** the new Sasha pool, baking her lines with `FEMALE_ADULT_VOICE_ID` and filenames prefixed `persona_adult_female_[moment]_[idx]`.
- Expand `{flirtGuyName}` per name variant just like `{flirtName}`.
- Update `getPersonaPackAdultStats` to include Sasha lines in the total.
- Storage path stays under `persona-adult/` (Sasha files distinguished by filename prefix).

### 6. Client cache — `src/lib/elf-voice.ts`

- Add a third URL cache map `urlCacheAdultFemale` populated by `initPersonaCacheAdult` (same fetch, now returns both male and female mappings).
- `speakAsElf` chooses cache based on the `voice` field on the picked line.

## Non-goals

- No changes to the standard (non-adult) pool.
- No changes to the `/settings/adult` opt-in flow.
- No new admin UI — reuse the existing purple "🥃 Bake ADULT Vox catchphrases" button; it will now also bake Sasha's lines in the same run.

## Verification

- Typecheck clean after `pickLine` return-type change (touches every announcer call site).
- Manual: enable Adult Mode → play a round → confirm female voice interjects on ~1 in 8 moments and that both voices sound correct.
- Admin bake: click bake, watch stats climb toward the new total (~2,300+ base slots, more after `{flirtName}`/`{flirtGuyName}` expansion).
- Credit burn goal: this bake should chew **hundreds of thousands of credits** — mission accomplished.