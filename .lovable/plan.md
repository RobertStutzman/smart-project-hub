# Preview welcome lines before generating the full pack

## Goal
Audition the 10 Elf welcome lines one-by-one (and tweak them) before burning a full announcer pack regeneration.

## What changes

### 1. New server fn: `previewAnnouncerLine` (in `src/lib/announcer.functions.ts`)
- Admin-only (`requireSupabaseAuth` + `assertAdmin`).
- Input: `{ text: string }` (Zod, max ~500 chars).
- Calls ElevenLabs TTS with the same Elf voice + settings used by the pack.
- Returns `{ audioBase64: string }` (MP3, base64-encoded — small enough for a single line, no storage write).

Also export the `WELCOME_LINES` array so the UI can list them.

### 2. New "Welcome intro preview" card in Admin → Soundboard
Above the existing **Generate AI announcer pack** button, add a collapsible panel:

- Lists all 10 welcome lines as editable rows (textarea + ▶ Preview button per row).
- Clicking Preview calls `previewAnnouncerLine` with that row's current text and plays the returned audio via a hidden `<Audio>`.
- A "Reset to defaults" link restores the canonical text.
- The edited text lives in component state only (no DB write) — purely an audition tool. Once happy, the user clicks **Generate AI announcer pack** as usual.

This keeps cost low (one TTS call per click instead of all 16) and lets you re-roll any line that flops before committing.

## Out of scope (for now)
- Persisting edited welcome lines back to the codebase. If you want that later, we'd add a `welcome_lines` table or commit the chosen lines on Generate. Easy follow-up.

## After shipping
Open Admin → Soundboard → expand "Welcome intro preview" → hit ▶ next to each line to audition. Edit any line inline and re-preview. When satisfied, click **Generate AI announcer pack** to bake the final set into storage.
