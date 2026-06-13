# Stop announcer from re-pitching "scan the code" after players join

## Problem
The lobby announcer plays the join-instructions opener ("Scan the QR code on screen, or type the four-letter code…") at the top of every lobby, and the rotating idle banter (`IDLE_GENERIC`) keeps pushing scan/code lines like "Come on, the code is right there — {code}" forever. Once a player has joined, hearing "scan the code" again is annoying — they already did that.

## Fix

### 1. `src/routes/host.tsx` — gate the opener on player count
In `speakWelcomeAndOpener` (around line 452-462):
- Always speak the `pickWelcomeIntro()` line (the "Welcome to Beat the Drop" hype).
- Only speak `pickOpener()` (the scan/join instructions) when `playersRef.current.length === 0`.

This way the opener is reserved for the true "QR code room" moment — empty lobby, waiting for the first phone to connect. Once anyone is in, we stop pitching the join instructions.

### 2. `src/lib/lobby-banter.ts` — split idle lines that reference scanning/code
Move the lines that explicitly reference the join code or scanning out of `IDLE_GENERIC` into a new `IDLE_JOIN_NUDGE` pool:
- "Come on, the code is right there — {code}. Four letters. You got this."
- "The code is {code}. Yes, still. It hasn't changed in the last ten seconds."

Update `pickLobbyLine` so `IDLE_JOIN_NUDGE` is only mixed into the pool when `count === 0` (and maybe `count <= 1`) — never once a real crowd is in the room. The remaining `IDLE_GENERIC` lines (small-talk, "tick tock", "I'd start a podcast…") stay in rotation for any player count.

### 3. Leave intact
- `WELCOME_INTROS` (no scan content).
- `IDLE_LOW/MID/HIGH` (they reference `{count}` and occasionally `{code}` as a "tell stragglers" nudge — those still make sense once people are in).
- The replay-lobby branch (already suppresses the opener).

## Verification
- Fresh lobby, 0 players: hear Welcome + "scan the QR…" opener, then idle quips include the "code is right there" nudges.
- One player joins: no more "scan" opener on subsequent navigations; idle quips stop using the explicit "code is right there / scan" nudges.
- Replay lobby: still silent on opener (unchanged).
