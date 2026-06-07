# Next playtest pass

Six tracks based on what you flagged. I'll do them in this order so each one builds on the last and we can stop after any track if you want to playtest.

## 1. Jackbox-style pre-game lobby (priority — #4)

The current "lobby" is just the host admin screen with a Start button — that's why it felt like the game appeared out of nowhere. Jackbox-style means the TV itself is the lobby, with hype.

**TV side (host.tsx lobby view):**
- Big room code + join URL/QR front and center, animated
- Live "players joining" rail: avatars pop in with a sound + bounce as each player joins
- Player count chip: "3 of 8 in" with a pulsing dot
- Idle loop tips/jokes cycling at the bottom ("Phones out, thumbs warm…")
- Start button only enables when ≥1 player is in; replaced by a host-only floating control instead of the current admin panel UI
- When host hits Start: a 3-2-1 "Get ready" countdown plays on TV with a stinger, THEN the existing IntroStage cold-open runs

**Phone side (play.tsx waiting state):**
- After join: "You're in!" confirmation with avatar + nickname locked in
- "Waiting for host…" with the player count from the room
- Little idle animation so the screen isn't dead

## 2. Recap flow polish (#1)

- Add a thin progress bar across the bottom of the standings screen showing the 4.5s auto-advance countdown ("Next round in 4…3…2…1")
- Subtle "Round 2 starting" label fades in as the bar fills
- Optional host override: tapping space skips the wait

## 3. Final round QA + juice (#2)

- Walk through the wager → final question → reveal → winner spotlight → credits chain in code, fix any dead ends
- Make sure the wager screen on phones is obvious and time-bounded
- Punch up WinnerSpotlight: confetti + winner avatar zoom + score callout, hold long enough to celebrate
- Verify credits roll auto-returns to lobby or sits cleanly

## 4. Player-side polish (#3)

- Lock-in feedback: stronger vibration pattern + visual "Locked!" stamp on the answer card
- Right/wrong feedback after reveal: green pulse + double vibration on correct, red flash (contained to card, not whole screen) + long vibration on wrong (we did this — verify it survived recent edits)
- Between-question state: show running score + streak count + a "Get ready…" pulse instead of going blank
- Make sure haptics fire on lock-in too, not just on reveal

## 5. Host taunts + hype (#5)

- Wire announcer TTS into more moments using existing host-persona lines:
  - Wrong-answer taunt after reveal (occasional, not every Q)
  - Streak hype at 3+ correct in a row
  - "Fastest finger" callout during recap reel
  - First-place callouts on leaderboard
- Rate-limit so it doesn't talk over itself or get annoying

## 6. Admin tooling polish (#6)

I'll do a quick audit of admin-questions, admin-sounds, admin-tts and propose specific fixes in a follow-up — this one needs your input on what's actually missing. Likely candidates: bulk question import, sound preview-on-hover, question stats visibility, room list/cleanup.

---

## Technical notes

- Lobby revamp lives in `src/routes/host.tsx` (TV lobby JSX) + `src/routes/play.tsx` (phone waiting state). Countdown becomes a new `CountdownStage` component or a new `phase: "countdown"` before `"intro"`.
- Recap countdown bar: small addition inside the leaderboard branch of `HostGameStage.tsx`, driven by the existing 4500ms timer.
- Player polish: `src/hooks/use-haptics.ts` already exists; verify it's called from `play.tsx` on lock-in + reveal.
- Taunts: extend `src/lib/announcer.functions.ts` calls from `HostGameStage.tsx` reveal/leaderboard branches, gate with a `useRef` rate-limiter.
- No DB schema changes needed. The `lobby` phase already exists; we're just making the TV render it instead of the admin panel when a room is live.

---

## Suggested order to build & test

1. Lobby + countdown (biggest visible win, #4)
2. Recap progress bar (#1, tiny)
3. Player-side polish (#3, also small but impactful)
4. Host taunts (#5)
5. Final round QA (#2, needs a full playthrough to verify)
6. Admin polish (#6, after you tell me what's annoying you there)

Want me to do all 6 in one go, or stop after #1-3 so you can playtest before I touch the rest?
