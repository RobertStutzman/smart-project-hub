## What broke

There are three separate regressions in the current code:

1. The phone player page explicitly starts background music in lobby/question phases. That is why random music plays on your phone.
2. The player answer buttons can stay blocked because `/play` calculates the “reading/countdown” state from a `now` timer that only advances when `room.phase === "question"`, but that interval closure captures an old `room` value. If `now` stops updating, the app thinks the pre-answer read window is still active and disables the answer grid.
3. The rules screen is visual-only. `HowToPlay` shows the rules slides, but no voice is attached there, so the announcer no longer explains the rules while that screen is up.

## Fix

### 1. Remove all automatic music from the phone player page

In `src/routes/play.tsx`:

- Remove `startMusic` from imports.
- Remove the `useEffect` that starts `startMusic("lobby")` and `startMusic("tense")` on the phone.
- Keep `stopMusic()` on Leave so any old loop is still killed if present.
- Keep short tap/answer SFX only.

Result: phones are controllers again, not speakers.

### 2. Fix answer buttons being blocked after the read window

In `src/routes/play.tsx`:

- Replace the stale interval logic with a simple stable clock interval that updates `now` every 250ms while the page is mounted.
- Keep the existing `reading` logic, but now it will actually count down to zero.

Result: the answer grid unlocks when the question is live.

### 3. Restore rules narration on the How To Play screen

In `src/components/HowToPlay.tsx`:

- Add a small narration effect for each slide using the existing `speakPersona` / voice path.
- Narrate the current slide title + body when the slide appears.
- Cancel or interrupt prior slide speech when moving to the next slide/closing.
- No new UI, no timing changes.

Result: when the rules screen comes up, the announcer explains the rules again.

### 4. Do not touch the Silk audio unlock plan right now

Given this regression, I will not add the Amazon Silk audio-unlock primer in this pass. First I’ll restore the known gameplay behavior: no phone lobby music, clickable answers, rules voice back.

## Files to change

- `src/routes/play.tsx`
- `src/components/HowToPlay.tsx`

No database changes. No security/RLS changes. No admin sounds changes.