# Lobby intro: stop the cut-off + add a dozen intro variants

## What's happening today
On the QR/lobby screen two things race:
1. **Opener** (`pickOpener()` → "Scan the QR code…") is scheduled at 2.4s via `speakPersona`.
2. **Welcome intro** clip from the DB (`vo_welcome_*.mp3`) is fetched async in a parallel effect and, when it lands, calls `playVoiceUrl(..., { interrupt: true })`.

Because the welcome fetch usually finishes mid-opener, `interrupt: true` cancels the opener mid-sentence and then plays the welcome — exactly what the user described.

For "variants": the DB has 11 `Welcome*` rows but they were all generated from the same script, so it feels like one. Adding more recorded files would require an upload pipeline; instead we'll generate the welcomes through the existing ElevenLabs "Elf" voice (same path as every other persona line, with caching via `tts_call_log`).

## Fix

### 1. `src/routes/host.tsx` — sequence welcome before opener, no interrupt
- Drop the DB-clip welcome path (`welcomes` from `getActiveSounds`) for the lobby.
- On lobby mount: pick a random line from the new `WELCOME_INTROS` pool and `speakAsElf(line, { preset: "hype", interrupt: false })`. This is the first thing queued, so nothing to interrupt.
- The opener (`pickOpener()`) is queued right after the welcome with `interrupt: false`. Because `speakAsElf` is a single-line FIFO queue, the opener will play only once the welcome finishes — no overlap, no cut-off.
- Remove the 2.4s `setTimeout` for the opener (no longer needed; queue handles ordering).
- Leave the rotating quip tick and `isElfSpeaking()` busy-skip alone; they already behave correctly once the queue is occupied.

### 2. `src/lib/lobby-banter.ts` — add `WELCOME_INTROS` (12+ lines)
New exported array of distinct "welcome to the show" lines in the host persona's voice, e.g.:
- "Welcome to Beat the Drop, the trivia show where confidence goes to die."
- "Lights up — it's Beat the Drop. The only trivia game with a body count."
- "You're tuned in to Beat the Drop. Brains optional. Bravery required."
- (…12+ total, each ~6–12 words so the queued line clears in under ~6 seconds)

Export `pickWelcomeIntro()` mirroring `pickOpener()`.

### 3. `src/lib/sounds.functions.ts` — leave alone
We stop *consuming* the `welcomes` field on the host lobby, but keep the server fn shape intact so admin tooling and any other callers don't break. No DB or schema changes.

## Verification
- Open `/host`, watch the network: only one ElevenLabs (or cache-hit) request at a time; welcome plays to completion, then opener plays cleanly.
- Refresh several times — confirm welcome line varies across the 12+ pool.
- `tts_call_log` shows cache hits after the first run of each line.
