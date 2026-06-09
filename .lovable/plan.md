## Two real problems

1. **Wildcard Q5 explanation gets cut off** — the previously approved fix to `useRevealAutoAdvance` was never landed; the hook still advances out of `reveal` the instant the persona reaction stops, before the "Did you know?" explanation has even started playing (because it's queued behind the persona reaction and personalized callout, then auto-advance lands in the gap and moves the room to `leaderboard`).
2. **Announcer talking over himself** — two places call into the voice queue with `interrupt: true` while another line may still be in flight:
   - `RoundRecapReel.tsx` scoreboard beat: `speakPersona("Here's how round N shook out.", { interrupt: true })` — kills any explanation line still playing when the recap mounts at start of `leaderboard`.
   - `HostGameStage.tsx` round/wildcard callout (~line 546): `speakAsElf(text, { interrupt: true, preset: "hype" })` — kills any tail of leaderboard/recap voice when the next question's phase flips to `question`.

## Fix

### A. Land the explanation-playback signal (fixes #1)

**New `src/lib/explanation-playback.ts`** — module-level state: `{ qid, expected, started, ended }` with `markExplanationExpected(qid)`, `markExplanationStarted(qid)`, `markExplanationEnded(qid)`, `resetExplanationFor(qid)`, `getExplanationStateFor(qid)`.

**`src/components/host/HostGameStage.tsx`** — in the explanation `useEffect` (lines ~338–367):
- On the qid+url+reveal entry, call `resetExplanationFor(qid)` and `markExplanationExpected(qid)` immediately (before the 3800ms setTimeout).
- Inside `playVoiceUrl`'s `onStart`/`onEnd`, also call `markExplanationStarted(qid)` / `markExplanationEnded(qid)`.
- In the "leave reveal" effect (lines ~371–383), call `resetExplanationFor(null)`.

**`useRevealAutoAdvance` (same file)** — gate advance on explanation state:
- Read `current_question_id` from the caller. Update its signature to accept `currentQuestionId: string | null` and `hasExplanation: boolean`, and update the call site in `src/routes/host.tsx`.
- In the poll: if `hasExplanation` is true, do NOT advance on the `sawSpeech && !speaking` heuristic. Only advance when `getExplanationStateFor(qid).ended === true`, OR when the 45 s safety cap trips.
- Keep the "no explanation at all" branch (`elapsed >= SPEECH_START_DEADLINE_MS && !sawSpeech`) for rooms where `hasExplanation === false`, so they still move on after the persona reaction ends.

### B. Stop the queue-interruptors (fixes #2)

**`src/components/host/RoundRecapReel.tsx`** — drop `{ interrupt: true }` from the scoreboard `speakPersona` call (line 167). The recap line should queue behind anything still in flight, not cut it.

**`src/components/host/HostGameStage.tsx`** — drop `{ interrupt: true }` from the round/wildcard callout `speakAsElf` (line 546). The callout already fires only when entering `question` from a break, and queuing keeps the leaderboard/recap voice from being chopped off mid-sentence.

### Out of scope

- No edits to `elf-voice.ts`, `persona-live.ts`, `announcer.functions.ts`, ambience/music engines, DB, RLS, the wildcard banner, or the new leaderboard/recap bar charts.
- Other `interrupt: true` callers (`HowToPlay.tsx` slide changes, `CreditsStage.tsx` open) are intentional UX cancels and stay as-is.

## Verification

- Run a wildcard Q5: persona reaction → personalized callout → "Did you know?" plays to completion → THEN room flips to leaderboard. The announcer never overlaps himself; recap line waits its turn.
- Run a normal Q (non-wildcard, with explanation): same — explanation plays to completion before nextQuestion fires.
- Run a question with no baked explanation (hasExplanation=false): existing 4.5 s deadline still advances after the persona reaction ends.
- Safety cap still bounds a hung audio element at 45 s.