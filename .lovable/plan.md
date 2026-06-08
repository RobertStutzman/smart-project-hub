# Bulk-import hundreds of questions from Gemini

The "20 questions max" wall isn't your importer — it's Gemini truncating long JSON arrays in one reply. Trying to make Gemini emit 200 in one shot will keep failing. Better answer: let you paste many small batches in a row, plus accept richer paste formats and import the whole pile in one click.

## What changes in the Gemini Importer

Currently: one textarea, hit "Validate" → "Import" → it clears. Past 20 the JSON gets cut off mid-array and the parse throws.

New flow:

1. **Accumulating staging area.** The "Pasted JSON" textarea becomes an "Add batch" workflow. Paste batch 1, click "Add batch" — it validates and adds the rows to a staged list below. Paste batch 2, click "Add batch" again — appended. Repeat as many times as you want. Counter shows "Staged: 137 questions (134 valid · 3 issues)".
2. **Smarter parser.** Replace `parseGeminiJson` so a single paste can contain:
   - one JSON array (current behavior)
   - multiple JSON arrays back-to-back (`[…][…]`) — Gemini sometimes splits them
   - NDJSON (one `{…}` per line)
   - prose + a fenced code block with JSON inside
   - trailing commas / smart quotes (lightly normalized)
   It returns whatever it can parse and reports the rest as issues, instead of throwing on the first hiccup.
3. **De-duplication.** When appending, drop rows whose normalized `question_text` already appears in the staging list (case-insensitive, whitespace-collapsed). Toast says "Added 18 · skipped 2 duplicates".
4. **Upload a file.** Add a small "Upload .json / .txt" button next to "Add batch" — reads the file as text and runs it through the same parser. Lets you paste 500 questions into a text file from anywhere and load it in one shot.
5. **Chunked import.** "Import all" sends the staged rows to `bulkInsertQuestions` in chunks of 200 (well under the existing 500 cap) so a 500-question import doesn't hit any single-request size limit. Progress toast: "Imported 200 / 500…". On error in one chunk, the rest still proceed and a summary toast lists failures.
6. **TTS bake after the whole pile.** "Bake voice narration" runs once at the end with `limit = max(stagedCount, 50)` instead of per-batch, so you don't kick off ElevenLabs 25 times.
7. **Lift the input cap.** Per-difficulty count cap goes from 20 → 25 (Gemini's reliable single-response ceiling) and helper text changes from "max 20" to "Gemini truncates above ~25 — generate in batches and add each one." A small "Why?" tooltip explains.

## Prompt tweak

Append one line to `buildGeminiPrompt`:
"If you can't fit all questions in one reply, output as many complete objects as you can and stop cleanly with `]` — do NOT continue across messages."

This stops Gemini from dribbling a half-array into a follow-up that won't paste cleanly.

## Files touched

- `src/routes/_authenticated/admin.tsx`
  - Rewrite `parseGeminiJson` to multi-array / NDJSON / fenced-block tolerant.
  - Replace `GeminiImporter`'s single-shot state (`pasted` / `parsed`) with `pasted` (current batch) + `staged: ParsedRow[]` (accumulator) + `dupeKeys: Set<string>`.
  - Add "Add batch", "Upload file", "Clear staged" buttons; keep the existing per-row skip toggles working on the staged list.
  - Change `doImport` to chunk staged rows by 200 and import sequentially with per-chunk toasts.
  - Bump per-difficulty count `max` from 20 → 25 in the two `<input>`s and helper labels.
  - Append the "stop cleanly" line in `buildGeminiPrompt`.

No DB changes, no server-function changes — `bulkInsertQuestions` already accepts up to 500 per call and we'll stay under that.

## Out of scope

- Server-side AI generation (`AIGenerator` panel) — already works, separate path.
- CSV importer (`CsvDropzone`) — already there and unchanged; if you ever want, exporting a Gemini batch to CSV from a spreadsheet is the most bulletproof route, but the new paste-accumulator should make that unnecessary.
- Resumable / saved drafts across page reloads.
