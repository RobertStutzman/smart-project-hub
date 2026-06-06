## Goal
Remove the 5-second "reading window" so players can buzz in the instant a new question appears, instead of waiting for a countdown.

## What's there today
When `nextQuestion` reveals a question (`src/lib/game.functions.ts:232`), it sets `question_started_at` to **`now + 5000ms`**. Both the host (`HostGameStage`/`QuestionStage`) and the player (`play.tsx`) treat any time before that timestamp as a "reading" phase — answers are dimmed, the answer grid is `pointer-events-none`, the buzzer is disabled, and a big countdown number shows on top of the question.

## Change
One line in `src/lib/game.functions.ts` line 232:

```ts
// before
question_started_at: new Date(Date.now() + 5000).toISOString(),
// after
question_started_at: new Date().toISOString(),
```

That's it. Because `readSecondsLeft = max(0, startMs - now)`, setting `startMs = now` makes `readSecondsLeft` immediately `0` on both host and player, so:
- The answer grid is interactive on the very first frame.
- The big read-countdown number never renders.
- The 15-second answer timer begins counting down right away (no change to total question duration).
- Media (`QuestionAudio`/`QuestionVideo`) auto-starts immediately, because their `autoStart={!reading}` flips true from the start.
- The Elf's question voiceover still plays over the top — the buzzer just isn't gated behind it (matches the choice we made when adding question TTS).

## Not changing
- `question_duration_ms` stays at 15 s (the actual answering window).
- The final-round flow (`startFinalQuestion` already uses `now` with no read window — unchanged).
- No DB migration, no UI rewrites, no player/host component changes — the "reading" branches stay in the code but just never fire. Leaving them in place keeps the door open if you ever want to re-add a per-room "reading delay" setting later.

## Out of scope
- Making the read delay configurable per room/round. If you'd like a slider in the host controls ("0 s / 3 s / 5 s read time") instead of hard-removing it, say the word and I'll plan that variant instead.
