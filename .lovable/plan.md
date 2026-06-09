## Goal

Consolidate all sound/voice baking on the **Sounds** page. Keep the Maintain tab for text-only work.

## What moves

**Move `ExplanationTTSBackfill`** (🔊 "Narrate Did you know?" — bakes Elf audio for explanations) from the Maintain tab in `admin.tsx` to the Sounds page (`admin-sounds.tsx`), placing it directly next to the existing `QuestionVoiceoversPanel` (🎙 "Narrate questions") so both voice bakers sit together.

## What stays

- **`ExplanationBackfill`** (💡 "Did you know? backfill" — LLM writes the explanation TEXT) stays on the Maintain tab. It's not sound, it's just words.
- **`QuestionVoiceoversPanel`** stays on Sounds where it already is.
- In-game playback, server functions, and ElevenLabs wiring — untouched.

## Steps

1. In `src/routes/_authenticated/admin-sounds.tsx`: import `getExplanationTTSStats` and `bakeAllExplanationTTS` from `@/lib/announcer.functions`. Add a new panel component (or inline-import the existing one) that mirrors the look of `QuestionVoiceoversPanel`. Mount it next to that panel.
2. In `src/routes/_authenticated/admin.tsx`: remove the `<ExplanationTTSBackfill />` render from the Maintain tab and delete its component definition + related imports (`bakeAllExplanationTTS`, `getExplanationTTSStats`) if no longer used.
3. Verify Maintain tab still renders cleanly with just the two remaining cards: 💡 backfill + 🛠 duplicate-answers repair.

## Out of scope

- Re-baking anything that's currently mid-run.
- Renaming buttons or restyling.
- Touching the cost circuit-breaker / `TTS_CAP_PER_GAME` panel already on Sounds.
