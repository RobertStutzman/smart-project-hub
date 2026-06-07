Tackling your list one item per fix. Each is small and targeted.

## 1. Phone shows your name + a clear "locked in" reaction
On `play.tsx`, when you tap an answer, the only feedback today is the avatar moving on the TV. Change:
- Add `Haptics.tap()` + `play("lock")` in `pick()` (currently silent).
- When `me.current_answer !== null` during a question, show a big "✓ LOCKED — {nickname}" pill at the top of the answer grid with the answer letter, in your team color.
- On lock, briefly flash a green ring around the screen edge.

## 2. Question text back on the phone
Replace the "Check TV for question" placeholder during the `question` phase with the actual `room.current_question_text` (smaller font, 3-line clamp). Keep the timer/points pill above it.

## 3. Hide other players' picks until reveal
- Host `QuestionStage.tsx`: stop rendering `locks` avatars under each answer during `phase === "question"`. Only show them on the `reveal` phase, AND in the meantime only show avatars on already-`dropped` answers (so you can see who got eliminated).
- Phone `play.tsx`: remove the live `avatarsByIndex` peer-pick avatars on `AnswerGrid` during `question` phase; keep the count of locks via the "Locked X/Y" progress bar only.

## 4. Slower timer + breathing room between eliminations
- `nextQuestion` and final round: `question_duration_ms` 15000 → **25000**.
- `HostGameStage` `DROP_AT_ELAPSED_S` [4, 8, 11] → **[9, 15, 20]** (drops every ~6s, last drop 5s before time-up).
- `FINAL_HOLD_MS` 1500 → **2500** so the lone correct answer holds longer before the reveal cuts in.
- `useRevealAutoAdvance` reveal hold 8000 → **6000** between questions (faster pacing between, slower within).
- Update `PointsTicker`/`PlayerPointsTicker` `max` to read from `room.question_duration_ms / 1000` instead of the hard-coded `15`.

## 5. Stop the duplicate announcer sounds per question
HostGameStage currently fires:
- TTS audio (per question)
- `playEvent("round_intro")` on the first question of each round
- `playEvent("reveal")` + `playEvent("correct"|"wrong")` on endQuestion
- `playEvent("leaderboard"|"final"|"victory")` on phase stings
…all of which can stack with the question TTS still playing. Fix:
- Guard `round_intro` so it only fires when `state.phase` transitions from `lobby`/`leaderboard` to `question` (not on every question of a round).
- Skip `playEvent("reveal")` entirely (the correct/wrong sting already plays right after — it's a duplicate).
- Before starting question TTS, stop any currently-playing event sound via a single shared `currentAnnouncerRef` so only one announcer voice is audible at a time.

## 6. Final round actually works on the phone
Today: host starts the final round → room goes to `final_intro` for 5s, then `final_wager`. If the host's `HostGameStage` is not mounted (or the player joined mid-intro / phase update missed), the phone is stranded on a "Final Round" placeholder with no controls.

Fix:
- `startFinalRound` server fn: set phase directly to **`final_wager`** (drop the `final_intro` dead-time entirely). The TV still shows the "Final Round" cinematic for 3s as an overlay on top of the wager scene — driven by a local `setTimeout` in `HostGameStage`, not by a DB phase. Phones always see the wager UI immediately.
- Remove the `final_intro → final_wager` setTimeout from `HostGameStage` orchestrator (no longer needed).
- On phone, also accept `final_intro` as a valid wager phase (fallback) so existing in-flight rooms unstick.
- Increase final wager window 20s → **30s** in HostGameStage orchestrator.

## 7. Browser/TV view fits on screen
`HostGameStage` `QuestionStage` renders 4xl–6xl headlines + 2xl/3xl answer text + a points ticker + timer ring + media + explanation, all inside `h-full` with no shrink. On a 720p browser tab this overflows. Fix:
- Add `overflow-hidden min-h-0` to the root motion.div and `min-h-0` to the answer grid (already there) — but also clamp question heading to `text-3xl sm:text-5xl` (down from `text-4xl sm:text-6xl`) and clamp media to `max-h-[28vh]` (down from 36vh).
- Make the points ticker + timer ring `scale-90` on viewports under 1024px.
- Wrap the explanation in `max-h-[20vh] overflow-auto` so a long fun-fact never pushes answers off-screen.

## What I won't touch
- Scoring math, wildcard rules, leaderboard layout, admin page, sounds admin, selfie flow.
- Database schema (all changes are render/timing/server-fn behavior).

After approval I'll do all 7 in one pass, then sanity-check the build.