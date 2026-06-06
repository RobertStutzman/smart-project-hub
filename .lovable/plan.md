# Announcer reads every question (pre-baked TTS)

## Goal
Have The Elf read each question's prompt out loud when it appears on the host screen, without slowing the game down. Audio is generated once when the question enters the bank and cached in storage, so reveal-time playback is instant. The buzzer stays unlocked immediately — audio plays over the question text.

## What changes

### 1. DB: cache the TTS audio path on the question
Add two columns to `public.questions`:
- `tts_path text` — storage path inside the `question-media` bucket (e.g. `question-tts/<uuid>.mp3`), `NULL` until baked.
- `tts_text_hash text` — short hash of the read text, so edits trigger a re-bake.

No RLS change needed (existing public SELECT is fine; only admins write).

### 2. Server: `bakeQuestionTTS({ questionId })` in `src/lib/announcer.functions.ts`
- Admin-only.
- Reads `question_text` (+ optional category/answer prefix — see "What gets read" below), hashes it, skips if hash matches existing `tts_text_hash`.
- Calls ElevenLabs TTS with The Elf voice (same `VOICE_ID` and settings used by the announcer pack, but `stability: 0.4`, `style: 0.6` — slightly calmer than welcome lines so questions stay intelligible).
- Uploads MP3 to `question-media/question-tts/<questionId>.mp3` (upsert).
- Updates `questions.tts_path` + `tts_text_hash`.

Also add `bakeAllQuestionTTS()` — iterates rows with `tts_path IS NULL` or stale hash, bakes sequentially with a small delay (rate-limit friendly), returns `{ baked, skipped, errors }` for the admin UI progress.

### 3. Server: include TTS URL in the question reveal payload
In `src/lib/game.functions.ts`, the function that serves the current question to the host (around lines 175–195 and 615–625) already returns the question row. Extend the returned shape with:
```ts
tts_url: string | null  // signed URL, 5-min TTL, or null if not yet baked
```
Generated via `supabaseAdmin.storage.from("question-media").createSignedUrl(tts_path, 300)`.

### 4. Host: play TTS on question reveal
In `src/routes/host.tsx` (or the question-stage component it renders — `src/components/host/QuestionStage.tsx`), when a new question becomes active and `tts_url` is set:
- Stop any previously playing question-TTS audio.
- `new Audio(tts_url)` → `play()` with `volume: 0.9`.
- Duck lobby music briefly if it's still playing (existing sound engine already supports this — reuse the announcer ducking).
- **Buzzer stays unlocked immediately** (per your choice). Audio just plays over the question; fast readers can buzz before The Elf finishes.
- If `tts_url` is null (not baked yet), silently skip — game still works.

### 5. Admin UI: bake controls in Admin → Soundboard
Add a new card "Question voiceovers" next to "Generate AI announcer pack":
- Stat: "X of Y questions have voiceovers" (count `tts_path IS NOT NULL`).
- Button **Bake missing question voiceovers** → calls `bakeAllQuestionTTS`, shows live progress (baked/skipped/errors).
- Button **Re-bake all** (confirms first) — clears `tts_text_hash` then runs the full bake.

Also add a single-question bake button in the question editor (wherever questions are created/edited) so new questions get audio immediately on save. If the question editor doesn't currently exist as a UI, skip this and rely on the admin bulk bake — confirm before building an editor page from scratch.

### 6. What gets read
Just the **question_text**. Not the answers (players read those faster than they listen, and reading them aloud would force everyone to wait through 4 options). Example: for *"Which planet has the most moons?"* The Elf says exactly that, then the player reads/picks from the grid.

## Cost & latency notes
- One TTS call per question, ever (unless text is edited). At ~80 chars/question and current ElevenLabs pricing, full bank ≈ pennies per hundred questions.
- Playback is instant — it's just a signed-URL `<audio>` from your existing bucket, no provider call at game time.
- Storage cost is negligible (~30 KB per clip).

## Out of scope
- Reading answer choices.
- Per-host voice selection (everyone gets The Elf for now).
- Auto-baking on question insert via DB trigger — keep it admin-triggered for cost control. We can add a trigger later if you want it fully hands-off.

## Technical bits
- Files touched: `src/lib/announcer.functions.ts` (new fns), `src/lib/game.functions.ts` (signed URL in reveal payload), `src/routes/host.tsx` + `src/components/host/QuestionStage.tsx` (playback), `src/routes/_authenticated/admin-sounds.tsx` (bake UI).
- Migration: add `tts_path`, `tts_text_hash` columns to `questions`.
- Bucket: existing private `question-media` — signed URLs only.

## After shipping
1. Run migration.
2. Open Admin → Soundboard → **Bake missing question voiceovers**, wait for the run to finish (a few minutes for a full bank).
3. Start a host session — every question now has The Elf reading it as it lands on screen, while players can buzz instantly.
