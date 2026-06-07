## Phase 1.5 — Swap Vox to The Elf (ElevenLabs)

Goal: kill `window.speechSynthesis` everywhere and route every Vox utterance through your existing ElevenLabs pipeline (voice `e79twtVS2278lVZZQiAD`, same one the announcer pack and question TTS already use).

### What changes

**1. New server fn — `speakPersonaLine`** (in `src/lib/announcer.functions.ts`)
- Input: `{ text: string, settingsKey?: "hype" | "calm" }`
- Returns: `{ audioBase64 }` (mp3)
- No admin gate (any authenticated host can call it during a game)
- Reuses existing `generateTTS()` helper + Elf voice ID
- `hype` preset = current welcome-line settings (style 0.9), `calm` = question-read settings (style 0.4)

**2. Client TTS helper — `src/lib/elf-voice.ts`** (new)
- `speakAsElf(text, opts?)` — calls `speakPersonaLine` via `useServerFn`-style direct invocation, plays returned base64 mp3 via `new Audio('data:audio/mpeg;base64,...')`
- In-memory LRU cache keyed by `text+settingsKey` so repeat catchphrases ("On fire!", "Lock it in!") only hit the API once per session
- Queue: if a line is already playing, new line waits (no overlap). `cancelElfSpeech()` interrupts.
- Falls back silently to no-op on error (never crashes the game)

**3. Pre-baked common lines** (extend `generateAnnouncerPack`)
- Add a `PERSONA_LINES` array covering every static catchphrase in `host-persona.ts` (correct, wrong, streak, intro beats, credits beats)
- On game start, client preloads these from storage via existing `sound_clips` lookup — instant playback, zero API latency for the hot lines
- Dynamic lines (player-name roasts, intro narration with roster) go through the live `speakPersonaLine` path

**4. Rip out `speechSynthesis`**
- `src/lib/host-persona.ts` `speakAsVox()` → calls `speakAsElf()` instead; delete the `SpeechSynthesisUtterance` block
- `src/components/host/HostGameStage.tsx` lines 193-339 → replace the two `speechSynthesis` blocks with `speakAsElf()` + `cancelElfSpeech()`
- `IntroStage.tsx` & `CreditsStage.tsx` → swap any persona calls to the new helper (they already go through `host-persona`, so this falls out free)

### Files touched

```text
src/lib/announcer.functions.ts   # add speakPersonaLine + PERSONA_LINES export
src/lib/elf-voice.ts             # NEW: client cache + queue + playback
src/lib/host-persona.ts          # speakAsVox → speakAsElf
src/components/host/HostGameStage.tsx   # remove speechSynthesis blocks
```

No DB migration. No new secrets (ElevenLabs already connected). No new env vars.

### Acceptance

- Cold open, reveal reactions, leaderboard roasts, final-round hype, credits roll all narrate in The Elf's voice
- Repeat lines play instantly (cached); first-time dynamic lines have ~600-1200ms TTS latency
- No `speechSynthesis` references remain in `src/`

### After this

Phase 2 (round themes + commercials) builds on this — round-theme stingers and commercial reads just call `speakAsElf()` + queue an SFX clip.
