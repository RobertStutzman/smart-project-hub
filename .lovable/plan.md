# Picture/Audio/Video Trivia — Round 2

Three additions to the question editor and host TV.

## 1. ElevenLabs voice generation (audio)

In the admin Media editor, add a "Generate voice" mode next to "Upload audio":
- Text input for the line to speak (max ~500 chars)
- Voice picker — small curated list (Roger, Sarah, George, Charlie, Liam, Brian, Jessica, Lily, Santa, Glitch)
- "Generate" button → calls server, saves MP3 to `question-media/audio/{uuid}.mp3`, sets `media_url` + `media_type='audio'`
- Inline `<audio controls>` preview, plus a "Regenerate" button

Connector setup: link the **ElevenLabs** standard connector (no existing link in workspace). Once linked, `ELEVENLABS_API_KEY` becomes available server-side automatically — no manual secret prompt.

## 2. Video clip questions

- Treat `media_type='video'` as a third option throughout (admin editor, room state, host TV).
- Admin uploader accepts MP4/WebM/MOV up to **25 MB** (videos run bigger than audio).
- Files stored in `question-media/video/{uuid}.{ext}`.
- Host TV renders a `<video>` element above the question text, max-height ~40vh, `object-contain`, **autoplay muted=false, controls hidden, loops off**, fires once when the read window opens (same trigger as audio).
- Hidden during the reveal phase, same as image/audio.

No DB schema change needed — `current_media_type` already stores a free-form string.

## 3. Bump audio upload cap to 15 MB

Update the admin uploader's client-side size check from 6 MB → 15 MB. No server change needed.

---

## Technical details

**New server function** in `src/lib/admin.functions.ts`:
- `generateQuestionVoice({ text, voiceId })` — admin-only. POSTs to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128` with `model_id: "eleven_multilingual_v2"`, gets MP3 ArrayBuffer, uploads to `question-media/audio/{uuid}.mp3` via `supabaseAdmin`, returns storage path. Reads `process.env.ELEVENLABS_API_KEY`; throws a clear error if missing.

**Voice ID constants** — small frozen object in admin.tsx so the picker labels stay readable.

**MediaEditor changes** (`src/routes/_authenticated/admin.tsx`):
- Add `"video"` to the type radio.
- Audio section gains a "Source: upload | AI voice" sub-toggle. AI voice shows text + voice picker + Generate button.
- Video section mirrors the audio upload UX (file input, preview, size cap 25 MB).

**Host TV changes** (`src/components/host/QuestionStage.tsx`):
- Extract current `QuestionAudio` logic into a generic `QuestionMedia` that switches on `media_type`. Video uses the same "play once when read window opens" hook the audio component already has.

**Storage policies** — existing `question-media` bucket policies already cover any path; no migration needed.

**Game wiring** — `resolveMedia` in `src/lib/game.functions.ts` already signs any path regardless of type, so video URLs flow through automatically.

## Out of scope

- AI video generation
- Voice cloning / custom voices beyond the curated list
- Per-question playback length trim UI (admin trims clips themselves before upload)
