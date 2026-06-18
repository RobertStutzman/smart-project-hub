## Bug fixes — post-playtest pass

### 1. Intro audio loop ("grab your phone" plays twice)
- `useLobbyChatter` calls `resetAmbience()` then `startLobbyChatter()`, and also re-attaches on `onAmbienceBlockedChange`. When the chatter track restarts mid-line it replays from the top.
- Fix: in `src/hooks/use-lobby-chatter.ts`, only attach gesture/blocked-state retries when the **first** `startLobbyChatter()` call resolves `false`. Once playback succeeds, ignore subsequent `onAmbienceBlockedChange(true)` until the consumer unmounts. Also gate the initial call with a module-scoped "already started" flag so React StrictMode double-mount can't fire two simultaneous starts of the welcome VO.
- Verify in console there is exactly one `startLobbyChatter` audible start per page load.

### 2. Host name → placeholder
- Change `HOST_NAME` in `src/lib/host-persona.ts` from `"Vox"` to `"[Insert Your Funny Announcer Name Here]"`.
- Audit and update any hard-coded "Vox" string (e.g. `pickHighlightVox` labels in `src/lib/player-highlights.ts`, "BEST_VOX"/"WORST_VOX" naming is internal only — leave). Grep `\bVox\b` in `src/` and replace user-facing instances.

### 3. First-question 3-2-1 countdown flashes only "1"
- In `src/components/host/IntroStage.tsx`, the `<AnimatePresence mode="wait">` uses `key={\`count-${count}\`}`, but the parent step stays `"countdown"` while only the keyed child changes. With `mode="wait"`, each new number must wait for the previous exit (≈250ms) before entering — at the 1.1s tick interval the visible window collapses, and the final "1" is the only one that lands cleanly before `step` flips to `"go"`.
- Fix: split the countdown into its own subtree (no `mode="wait"`) so each digit can crossfade independently; or remove `mode="wait"` just for countdown by rendering the digit outside the `AnimatePresence` and animating via `key` on a local motion.div. Confirm 3 → 2 → 1 are each on-screen ~900ms and the voice line "three… two… one" lines up.
- Note: this is the **intro** countdown before the very first question, not per-question. The existing "no pre-question 3-2-1 splash" rule is preserved.

### 4. Wrong-answer SFX too loud
- Locate the wrong-answer sound usage (likely `play("buzzer")` or a funny-sound id in `QuestionStage.tsx` / `HostGameStage.tsx`).
- Lower its `gain`/`volume` at the call site (or in `src/lib/sound-engine.ts` / `funny-sounds.ts` mapping) by ~50% so it sits beneath the music bed. Leave correct-answer and stinger volumes untouched.

### 5. Inverted leaderboard / round recap
- In `src/components/host/RoundRecapReel.tsx` (and any sort feeding it from `HostGameStage.tsx` / `player-highlights.ts`), the ranking sort comparator is reversed — first place is being treated as zero-score.
- Fix: ensure the sort is `b.score - a.score` (descending), and that "best" / "worst" picks in `derivePlayerHighlights` read `players[0]` as top, `players.at(-1)` as bottom. Add a guard: if all scores are equal, skip the "got none right" callout entirely.

### 6. "Everyone got it right" — answer changes during elimination
- Players can swap answers as wrong options are eliminated; current correctness check probably reads the **current** `players.answer` snapshot when the timer expires, which has already been auto-coerced toward the remaining options.
- Fix: snapshot each player's answer at the moment of submission and freeze it once the question timer reaches 0. Concretely: in `src/lib/game.functions.ts` resolve-question path, score against the answer row's `submitted_at <= question.ends_at` (or the latest such row) and ignore writes after `ends_at`. Disable client-side answer changes once `now >= ends_at` in `src/routes/play.tsx`. Also make any "auto-collapse toward remaining options" UI purely cosmetic — never re-submit on the player's behalf.

### 7. Final Round splash too long
- In `src/components/host/FinalIntroStage.tsx`, shorten the on-screen duration / `onDone` timeout (and matching VO budget) by ~40-50%. Trim any internal `setTimeout` chains so the title card holds ~2.5s instead of the current ~5-6s, then advances directly into the wager stage.

### 8. Glitch Round does nothing
- `src/components/host/GlitchOverlay.tsx` reads `room.glitch_active_until` but nothing currently writes that field, and answer elimination isn't wired to glitch rounds.
- Fix: in `src/lib/game.functions.ts`, when a Glitch round question opens, set `glitch_active_until = ends_at` on the room row and pick a target player (current leader). On the player view (`src/routes/play.tsx`), when `glitch_active_until > now` AND `player.id === room.glitch_target_id`, periodically swap/hide one wrong answer tile (CSS scramble + `aria-hidden`) so the targeted phone visibly glitches. On the host view, `GlitchOverlay` already renders correctly once `glitch_active_until` is set — verify the chyron shows and the screen-tear bands animate.
- Scope note: this is a behaviour wiring fix only; no schema additions unless `glitch_active_until` / `glitch_target_id` columns are missing — in that case add them via a migration with proper GRANTs and RLS.

### Verification checklist
- Hard reload preview → intro VO plays exactly once, no "grab your phone" repeat.
- Title card reads "Hosted by [Insert Your Funny Announcer Name Here]".
- First question: see 3, then 2, then 1, each ~1s, with matching voice.
- Wrong answer: buzzer is noticeably quieter than the music bed.
- Finish a 3-player round with distinct scores → recap names the actual top scorer first.
- Mid-question: change answer after another option is eliminated → if it was wrong, you get it wrong (not auto-correct).
- Final Round splash exits within ~3s.
- Glitch Round: leader's phone visibly scrambles; host TV shows fuchsia chyron + tear bands.

### Out of scope
- No new announcer content, no Adult Mode changes, no auth/profile changes, no schema changes beyond what Glitch Round strictly requires.