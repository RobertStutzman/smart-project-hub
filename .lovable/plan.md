## Quieter click + game-start countdown

### 1. Tame the click beep
`src/lib/sound-engine.ts`, in `play()`:
- `whoosh` (fires on basically every host button click) — drop gain from `0.18` → `0.07` and shorten duration `0.4s` → `0.28s`. Still gives a tactile swoosh, no longer dominates the room.
- `tap` (UI micro-tap) — drop gain from `0.12` → `0.05`.

These are the two click sounds wired to host buttons (Start, Skip, Roll credits, Play again, etc.) and to the player-side tap feedback. No call sites change.

### 2. Game-start countdown + announcement
`src/components/host/IntroStage.tsx` — add a new countdown beat between the existing "roster" and the existing "GO" stinger.

Sequence becomes:
1. `title` — "Tonight on Beat the Drop" + host name + hype TTS line (existing, ~2.6s).
2. `roster` — contestants reel-in (existing, ~3.6s).
3. **NEW** `countdown` — speak "Alright… here we go in three!" (one-shot persona line) and animate large `3` → `2` → `1` numbers, each ~700 ms with a `tick` sfx on entry and a soft scale/opacity pop. Final tick at "1" hands off to:
4. `go` — existing GO stinger, then `onDone()` → first question.

Total intro length stretches from ~8.4s to ~11s. Space-to-skip still cancels all of it (kill the new countdown timers too in the cleanup block).

Pure additive UI change inside IntroStage; no phase, server-fn, or HostGameStage edits.

### Memory check
The project memory forbids reintroducing the giant 3-2-1 *before each question*. This countdown is one-time at the very start of the game (intro phase only), so it's compatible — the per-question "Get Ready / Question N" splash + voice-paced reveal stays exactly as it is.

### Out of scope
- Per-question intro splash, question timer, reveal, leaderboard, credits — unchanged.
- Final-round phases — unchanged.
- No new sfx assets, no new TTS clips; reuses existing `tick` sfx and `speakPersona`.
