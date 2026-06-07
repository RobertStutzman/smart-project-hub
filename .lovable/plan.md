# Bake more variety + stop voice overlap

Two changes: more lines (less repetition across games), and a single shared voice queue (no more talking over itself).

## 1. Expand persona line pools (~3x)

File: `src/lib/host-persona.ts`

Grow every moment from ~10 lines to **~25 lines** of new, on-character Vox banter. Final totals per moment (target):

- `intro_hype`: 25
- `question_open`: 25
- `all_correct`, `all_wrong`, `split_correct`: 25 each
- `first_blood`: 25
- `streak_milestone`: 25
- `elimination`: 25
- `leader_changed`: 25
- `final_hype`: 25
- `credits_open`: 25

Total ≈ **275 lines** (up from ~112). Across a 12-question game with 4–6 persona moments fired per question, the chance of repeating the same line within one game drops to near zero, and repeats across 3–4 back-to-back games become rare.

Keep `pickLine()` as-is (seeded mod), but switch the seed to mix in `Date.now()` modulo a daily bucket so two games on the same evening don't land on the same line for the same `qid`.

**Re-bake step:** after expansion, the user clicks **Bake persona pack** in `/admin-sounds` once. That triggers one ElevenLabs call per new line (~160 new calls), stores MP3s to the persona-pack bucket, and every future game pulls them free from storage. No per-game cap is touched.

## 2. Single shared voice queue (no overlap)

File: `src/lib/elf-voice.ts` (extend), `src/components/host/HostGameStage.tsx` (refactor 2 effects)

**Problem today:** `speakAsElf` has its own promise queue, but the question-prompt TTS and the "Did you know?" explanation TTS are played via raw `new Audio(url).play()` in `HostGameStage`. Those two paths are *not* in the queue, so a persona line fired on `question_open` can stomp on the question read, and a `leader_changed` line can collide with the tail of a DYK clip.

**Fix:** promote the elf-voice queue into a small "voice bus" used by every speaking surface.

In `elf-voice.ts`, export a new helper:

```ts
// Plays a pre-existing URL through the same single-line queue.
// Used for question prompts + DYK explanations.
export function playVoiceUrl(url: string, opts?: { volume?: number; interrupt?: boolean; onStart?: () => void; onEnd?: () => void }): Promise<void>
```

It enqueues onto the same `queue: Promise<void>` `speakAsElf` already uses, so anything fired through either entrypoint waits its turn. `interrupt: true` cancels current playback (used for the question prompt — it should jump the line because it's the main event).

In `HostGameStage.tsx`:
- Replace the raw `new Audio(url)` block in the question-TTS effect (~line 212–226) with `playVoiceUrl(url, { interrupt: true, onStart: () => duckMusic(true), onEnd: () => duckMusic(false) })`. Drop `questionTtsAudioRef` — the queue handles cancellation via `cancelElfSpeech()` which `interrupt` already calls.
- Replace the raw `new Audio(url)` block in the DYK explanation effect (~line 271–282) with `playVoiceUrl(url, { onStart: () => duckMusic(true), onEnd: () => duckMusic(false) })` (no interrupt — it queues politely after any in-flight persona line).
- Keep the 3800ms `setTimeout` before the DYK call so the reveal animation has time to flip; the queue then guarantees the DYK waits if a `first_blood`/`split_correct` line is still finishing.

**Result:** at any moment exactly one voice is playing. Persona reactions naturally land in the gaps; if a persona line and a question read race, the question read interrupts (because it's flagged `interrupt`) and the persona line is dropped from the queue cleanly.

## Out of scope

- No DB / migration changes
- No change to `TTS_DEFAULT_CAP` or persona-pack bucket layout
- No new moments wired (`question_open`, `first_blood`, `leader_changed` etc. stay where they are)
- Round intro / credits / SFX paths unchanged

## Files touched

- `src/lib/host-persona.ts` — expand `LINES`, tiny `pickLine` seed tweak
- `src/lib/elf-voice.ts` — add `playVoiceUrl` reusing existing queue
- `src/components/host/HostGameStage.tsx` — route question + DYK audio through `playVoiceUrl`

## After implementation

You'll need to click **Bake persona pack** in `/admin-sounds` once to pre-cache the ~160 new lines. After that, every line plays free from storage.
