## Goal
- Adult Mode = same Elf voice + raunchier lines. Zero Bill anywhere.
- Standard game is untouched unless the user opts into Adult Mode via `/settings/adult`.
- Pre-bake all Elf content (standard + adult male pool) so credits burn now and playback is instant.

## Changes

### 1. Kill Bill, everywhere
- Remove any lingering `ADULT_VOICE_ID` / Bill (`pqHfZKP75CvOlQylNhV4`) references in `src/lib/announcer.functions.ts` and `src/lib/elf-voice.ts` (comments and any dead code).
- Adult male announcer voice is hardcoded to Elf (`e79twtVS2278lVZZQiAD`) in every code path — live TTS and bake.

### 2. Purge old Bill audio automatically
- On admin load (or via a one-click button), run `resetPersonaPackAdult` to wipe every `Persona Adult` row + `persona-adult/*` file, then re-bake in Elf.
- Namespace the fresh adult pack (`persona-adult-elf/` folder + `Persona Adult (Elf)` category) so we can never re-load a leftover Bill clip even if some file survives.

### 3. Pre-bake all Elf content now
Trigger these bakes in sequence from the admin page so credits burn without extra clicks:
- Standard Vox catchphrases (Elf voice) — full pool.
- Adult Vox catchphrases (Elf voice) — full raunchy pool including `{flirtName}` variants.
- Skip Sasha (Jessica) unless you want it — she's untouched.

Add a new admin button: **"🔥 Pre-bake ALL Elf content"** that runs standard bake → reset adult → adult bake in order, with progress toasts.

### 4. Keep standard game identical
- Standard players load `initPersonaCache` (Elf standard pack) exactly as today.
- Adult cache map only loads/plays when `sessionStorage['btd-adult-mode'] === '1'`.
- No changes to line pools, room state, question flow, or scoring.

### 5. Safety net
- If an adult line has no baked clip yet (e.g. new line added later), fall back to live Elf TTS instead of silent failure or standard-voice clip.

## Files touched
- `src/lib/announcer.functions.ts` — remove Bill refs, namespace new adult folder/category, add combined `prebakeAllElfContent` server fn.
- `src/lib/elf-voice.ts` — remove Bill comment, gate adult cache load behind adult-mode check, add live-TTS fallback on adult cache miss.
- `src/routes/_authenticated/admin-sounds.tsx` — add "🔥 Pre-bake ALL Elf content" button; update reset copy.
- `src/routes/host.tsx` — only call `initPersonaCacheAdult` when adult mode is on.

## Result
- Standard game: unchanged, Elf voice, standard lines.
- Adult Mode toggle on: same Elf voice, raunchier lines + occasional Sasha.
- Bill: gone from code, DB, and storage.
- All Elf audio pre-baked so live TTS is a rare fallback.