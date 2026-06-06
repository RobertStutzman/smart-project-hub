## Picture & audio trivia questions

Two new question types, mixed into the normal question pool. The `questions` table already has `media_url` + `media_type` columns; they're just unused. We'll wire them through end-to-end.

### 1. Storage

- **New private bucket `question-media`** (audio clips can be ~MB, don't belong in `avatars`). Policies: admin-only insert/update/delete, public read (so host TV `<audio>` works without signed URLs).
- Image questions: store generated PNGs in the same bucket under `images/`.
- Audio questions: admin uploads MP3/M4A/WAV under `audio/`.

### 2. Schema

Add to `public.rooms` so the active question's media reaches clients in the existing realtime broadcast:
- `current_media_url text`
- `current_media_type text` (`'image' | 'audio'`)

No change to `questions` — `media_url` + `media_type` already exist.

### 3. Admin UI (`src/routes/_authenticated/admin.tsx` + `src/lib/admin.functions.ts`)

In the per-question editor, add a **Media** section with a type picker (`none | image | audio`):

- **Image type** — text input + "Generate" button. New server fn `generateQuestionImage({ prompt })` calls Lovable AI Gateway (`openai/gpt-image-2`, non-streaming, `quality: "low"`, 1024x1024), uploads the PNG to `question-media/images/{uuid}.png` via `supabaseAdmin`, returns the public URL. Sets `media_url` + `media_type='image'` on the question. Re-generate button to try again. Manual URL input as fallback.
- **Audio type** — file input (accept `audio/*`, max ~5MB). Client uploads directly to `question-media/audio/{uuid}.{ext}` with the user's auth (RLS lets admins write), then sets `media_url` + `media_type='audio'`. Inline `<audio controls>` preview.
- AI bulk generation (`generateAiQuestions`) stays text-only for now — these new types are admin-curated.

### 4. Game wiring (`src/lib/game.functions.ts`)

In both places that start a round (`advanceRound` ~L148 and final round ~L555), include the question's media in the room update:
```ts
current_media_url: q.media_url,
current_media_type: q.media_type,
```
And clear them (`null`) on round-end / lobby transitions wherever `current_question_text` is cleared.

### 5. Host TV (`src/components/host/QuestionStage.tsx` + `HostGameStage.tsx`)

Pass `mediaUrl` / `mediaType` props into `QuestionStage`.

- **Image**: render above the question text in a contained, rounded frame (max-height ~40vh, `object-contain`). During the 5s read window it's full-brightness; during answer phase it stays visible but cards take focus.
- **Audio**: render a centered glass card with a big play button + waveform-ish progress bar. **Auto-play once** when the read window starts (browser autoplay is fine on the host TV after first user interaction in the lobby). Replay button. Loops are off — single playthrough, then players answer from memory. Hide the audio element entirely during `reveal` phase.

### 6. Player side (`src/routes/play.tsx` / `AnswerGrid.tsx`)

**No change.** Host-TV-only per your choice — phones just show answer buttons.

### Out of scope (ask later if you want)

- AI voice synthesis (you chose admin-upload).
- Dedicated picture/voice rounds (you chose mixed pool).
- Re-using images across questions / a media library view in admin.

### Technical notes

- Image generation is a `createServerFn` with `requireSupabaseAuth` + admin-role check; uses `supabaseAdmin` for the storage upload. Non-streaming Gateway call (we just need the final PNG to upload).
- Bucket is public-read but private-write — same pattern as `avatars`.
- Migration creates the bucket via `storage_create_bucket` tool, then a SQL migration adds the two `rooms` columns and the `storage.objects` RLS policies.

### Files touched

- migration: add `rooms.current_media_url`, `rooms.current_media_type`; storage policies for `question-media`
- new bucket `question-media` (via tool)
- `src/lib/admin.functions.ts` — `generateQuestionImage` server fn
- `src/routes/_authenticated/admin.tsx` — media editor UI
- `src/lib/game.functions.ts` — forward media on round start/clear on end
- `src/components/host/QuestionStage.tsx` — render image / audio player
- `src/components/host/HostGameStage.tsx` — pass props through