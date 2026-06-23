## Fixes

### 1. Final round — make it feel like the final round
- **Remove "Question 1" label**: in `HostGameStage.tsx` `final_question` render block, render `QuestionStage` with a new `hideQuestionNumber` prop (or pass `questionNumber={null}`). Update `QuestionStage` to omit the "Question N" title/subline when null. Replace with no label at all — the existing `★ Final question` chyron at the top already identifies it.
- **Replace bouncy/beeping bed** during `final_question`: don't start the standard `questionThink` ticking bed. Instead, in `HostGameStage.tsx` where music is selected per phase (~line 657 area), play a new dedicated *final tension* bed. Add `playFinalTensionBed(volume)` / `stopFinalTensionBed(fadeMs)` in `sound-engine.ts`. Source: generate an orchestral/cinematic loop via ElevenLabs Music (or reuse an existing dramatic asset if one is already loaded — check `wagerBed`/stinger assets first). Stop the standard `questionBed` for this phase.
- **Increase timer to 30s**: change `question_duration_ms: 25000` → `30000` in `game.functions.ts` at both `startFinalQuestion` (line 1002) and the final question seeding write (line 941).
- **Force a true "hard" pick**: in the final question fallback chain (lines 866–871), tighten attempt #1 to `["hard", "impossible"]` (already does) but remove attempt #2 (any difficulty in category) so we don't silently fall to easy/medium just because the chosen category is thin. Order becomes: hard/impossible in category → hard/impossible in any category → any (last resort, log a warning). Keep "impossible weighted 2×".

### 2. Standard question time — middle ground
- Change default `durationMs` for non-wildcard questions in `game.functions.ts` line 355 from `15000` → `20000` (and the same fallback in `lockAnswer` line 1327). Lightning stays 8s, sudden-drop stays as-is.

### 3. Lightning round — no tile drops
- Lightning currently uses 8s timer with no auto-drop logic (drops are only `sudden_drop`). However the host can manually call `dropOneWrong` (line ~408) during any question. Guard that server fn so it refuses when `room.wildcard === "lightning"`, and hide/disable any host control that triggers it during lightning in `HostGameStage.tsx` if one exists. Net effect: in lightning, all 4 tiles stay visible until time runs out — answer right or wrong, no help.

### 4. Stale "2!" countdown voice on game restart
- Root cause: when starting a new game from a finished one, the previous intro's queued digit TTS (`speakAsElf("Two!")`) is still buffered in `elf-voice`. The new `IntroStage` mounts and calls `cancelElfSpeech()`, but a digit already in-flight (loaded `<audio>` element) keeps playing.
- Fix in `IntroStage.tsx` mount effect: call `cancelElfSpeech()` AND a new `hardResetElfVoice()` that (a) stops any currently-playing audio element, (b) clears the priority queue, (c) bumps a generation counter so any in-flight TTS fetch's `.then(play)` no-ops. Add `hardResetElfVoice()` to `src/lib/elf-voice.ts`. Also call it once when transitioning out of `final_reveal`/`game_over` back into a fresh `lobby`/`intro` in `HostGameStage.tsx`.
- Belt-and-suspenders: gate `speakDigit` in `IntroStage` so it never speaks a digit whose visual slot has already passed (`elapsed > T_COUNT_<n+1>`) — prevents a delayed "2!" from playing while "1" or "GO" is on screen.

### Technical notes
- `QuestionStage` prop change: `questionNumber: number` → `questionNumber: number | null`; when null, skip the `title`/`subline` text. Single call site update needed in `final_question` branch.
- `sound-engine.ts` final-tension bed: mirror existing `playWagerBed` structure (loop, volume, duck-aware), import an mp3 asset; if generating fresh audio is out of scope this turn, temporarily reuse `finalWagerBed` (already cinematic) as the playing bed during `final_question` to immediately replace the beeping.
- No DB migration needed.

### Files touched
- `src/lib/game.functions.ts` (durations, hard-only fallback, dropOneWrong guard)
- `src/components/host/HostGameStage.tsx` (final question label off, final bed wiring, reset elf-voice on restart)
- `src/components/host/QuestionStage.tsx` (optional questionNumber)
- `src/components/host/IntroStage.tsx` (hard reset on mount, gate stale digits)
- `src/lib/elf-voice.ts` (`hardResetElfVoice`)
- `src/lib/sound-engine.ts` (final tension bed helpers)