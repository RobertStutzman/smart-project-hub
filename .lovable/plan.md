## Goal

Make Vox talk noticeably more — extra moments wired in + 3× the line pool — and make sure his zinger lands before the "Did you know?" narration on reveal.

## Changes

### 1. `src/lib/host-persona.ts` — bigger pools + new moments
- Expand every existing moment from 3 → ~10 lines.
- Confirm/keep these moments: `intro_hype`, `all_correct`, `all_wrong`, `split_correct`, `first_blood`, `streak_milestone`, `final_hype`, `credits_open`, `leader_changed`, `elimination`.
- Add one new moment: `question_open` (short hype on each new question, e.g. "Here we go." "Lock it in." "Don't think — feel.") — ~10 lines.

### 2. `src/components/host/HostGameStage.tsx` — wire new moments
- **`question_open`**: when `phase` flips to `"question"` and `current_question_id` changes, fire one short `speakPersona(pickLine("question_open", qid), { preset: "hype" })` ~250ms after the splash so it overlaps the answer tiles, not the question prompt VO. Skip if it would overlap the question-prompt TTS that's already playing.
- **`first_blood`**: when the first non-audience player flips from `current_answer === null` to a correct answer (within the same question id), speak a single `first_blood` line. Debounce: fires at most once per question id; ignore if reveal already passed.
- **`leader_changed`**: track the top scorer's session_id between reveals; when it changes (and we're past round 1), speak a `leader_changed` line during the brief gap before next question (after reveal+DYK finish).
- Keep existing reveal reaction logic but make it **queue AFTER** the DYK narration finishes instead of firing at 900ms. Implementation: stop scheduling the persona line at +900ms; instead, after the DYK audio ends (existing `useEffect` already plays it), enqueue `speakAsElf(persona)` so it lands right after. If there's no DYK URL, fall back to the current 900ms timer.

### 3. Persona pack bake
- The admin "Bake persona pack" button (`generatePersonaPack` in `admin-sounds.tsx`) already pre-bakes every line in `LINES`. After expanding pools, the user clicks **Bake persona pack** once and all new lines get cached to storage (free playback forever, no per-game cap charge).

## Out of scope
- No DB migration.
- No change to the per-game `TTS_DEFAULT_CAP=50` — pre-baked lines don't count against it.
- No change to `IntroStage`, `CreditsStage`, `RoundRecapReel`, or admin TTS infra.

## Files
- `src/lib/host-persona.ts` — pool expansion + `question_open` moment.
- `src/components/host/HostGameStage.tsx` — 3 new persona triggers + reveal reorder.
