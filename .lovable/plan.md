## Goal

Pre-bake an Elf-voiced narration of every question's "Did you know?" explanation, then auto-play it on the host screen the moment the full-screen reveal card appears (~2.2s after reveal).

The existing question-prompt TTS pipeline already does this for `question_text` (Elf voice, stored in `question-media/question-tts/<id>.mp3`, played from a signed URL in `HostGameStage`). We mirror that pipeline for `explanation`.

## Steps

### 1. DB migration
Add to `public.questions`:
- `explanation_tts_path text`
- `explanation_tts_text_hash text`

No new policies/grants needed (existing admin-update policy covers it).

### 2. Server: bake explanation TTS (`src/lib/announcer.functions.ts`)
Add two server fns mirroring `bakeOneQuestion` / `bakeAllQuestionTTS`:
- `bakeExplanationTTS({ questionId, force })`
- `bakeAllExplanationTTS({ force, limit })`

Storage path: `explanation-tts/<id>.mp3` in the same `question-media` bucket. Uses the same Elf voice via `generateTTS` with `QUESTION_VOICE_SETTINGS`. Skips rows whose `explanation` is null/empty. Hash-guarded so re-runs are cheap.

### 3. Surface URL in room state (`src/lib/game.functions.ts`)
At the three sites that already set `current_question_tts_url` / `current_explanation` (lines ~225/237, 709/721, 986), also resolve `explanation_tts_path` to a signed URL and write a new column `current_explanation_tts_url` on the room row.

Migration adds `current_explanation_tts_url text` to `public.rooms` (existing grants cover it).

### 4. Host playback (`src/components/host/HostGameStage.tsx`)
- Add `current_explanation_tts_url` to the room select + type.
- New `useEffect` mirroring the question-TTS one (lines 182-230), but:
  - Fires when `phase === "reveal"` and we have a `current_explanation_tts_url`.
  - Waits ~2200ms after reveal start (matches `QuestionStage`'s `revealStage` flip to fullscreen) before playing.
  - Ducks music while playing (`duckMusic(true)` → `false` on ended/pause/error).
  - Keyed by `current_question_id` so it plays exactly once per question.
- Cleanup on unmount / phase change, like the existing question-TTS effect.

No changes to `QuestionStage.tsx` — the visual fullscreen reveal already lands at the right moment.

### 5. Admin UI (`src/routes/_authenticated/admin.tsx`)
Add a section right under the existing "Did you know? backfill" panel:
- "🔊 Narrate Did You Knows" button → loops `bakeAllExplanationTTS({ limit: 25 })` until done, shows progress (baked / skipped / errors), same UX as the existing question-prompt TTS backfill.
- Read-only counter of how many explanations still need narration.

### 6. Backfill all 363 questions
After the migration deploys, click the new admin button once. It will:
- Skip any future questions added without an explanation (handled gracefully).
- Cost ~$0.20-0.50 one-time via ElevenLabs (cached forever; no per-game cost).

## Out of scope
- No changes to the existing question-prompt narration or the elf-voice queue (separate audio element, plays after the question-prompt read has long since ended).
- No changes to `play.tsx` (the player screen doesn't narrate — the host screen is the canonical narrator).
- Voice cost cap (`activeRoomId` / `speakPersonaLine`) is bypassed intentionally — pre-baked URLs are free to replay.

## Files touched
- New migration: `questions.explanation_tts_path`, `questions.explanation_tts_text_hash`, `rooms.current_explanation_tts_url`
- `src/lib/announcer.functions.ts` — add `bakeExplanationTTS`, `bakeAllExplanationTTS`
- `src/lib/game.functions.ts` — resolve + write `current_explanation_tts_url` in 3 spots
- `src/components/host/HostGameStage.tsx` — select column, add playback effect
- `src/routes/_authenticated/admin.tsx` — add backfill button + counter
