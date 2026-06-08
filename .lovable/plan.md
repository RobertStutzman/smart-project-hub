## Goal

Add an announcer voice on the QR/lobby screen: one welcome line the moment the host opens the lobby, then a rotating "what's taking so long" quip every 10 seconds while players are still joining.

## Behavior

- **Opener** fires once when the lobby mounts (after the host's click gesture so audio is unlocked).
- **Idle quips** loop on a 10s timer, drawn from a 10-line bank. Each cycle picks a random line that's different from the last one so it never repeats back-to-back. After all 10 are used, reshuffle.
- **Player-count aware**: lines have placeholders like `{count}` ("Still just {count} of you? My couch has more energy.") so the persona can call out the live join count.
- **Stops** as soon as the game starts (`phase === "intro"`) or the lobby unmounts. Also pauses while another persona line is mid-speech to avoid talk-over.

## Implementation

1. **New file `src/lib/lobby-banter.ts`**
   - Exports `OPENER_LINES` (~6 variants) and `IDLE_LINES` (10 variants) with `{count}` / `{code}` tokens.
   - Exports `pickLobbyLine(history, count, code)` that fills tokens and avoids repeating the last pick.
   - Branches the idle pool by player count: `count === 0` vs `count >= 1` vs `count >= 4` (different jabs) so quips stay context-appropriate.

2. **Wire into `src/routes/host.tsx`**
   - In the existing room/lobby effect, after ambience starts, call `speakPersona(pickLobbyLine([], ...))` once (the opener).
   - Add a `setInterval(10_000)` that fires `speakPersona(pickLobbyLine(history, players.length, room.roomCode))` and tracks the last 3 picks.
   - Guard: skip a tick if `roomPhase !== "lobby"` (i.e. game already started), or if a host TTS line is currently speaking (check the existing `isSpeaking` state if exposed, else just rely on `speakPersona`'s `interrupt: false`).
   - Cleanup interval on unmount / phase change.

3. **No new TTS infrastructure** — reuses `speakPersona` from `@/lib/host-persona`, which already handles the announcer voice + fallback synth.

## Line examples (final wording lives in `lobby-banter.ts`)

Opener: "Alright! Phones out, codes in — let's get this show on the road."
Idle (0 players): "Zero players. Bold strategy. Anyone? Anyone?"
Idle (low): "Two whole humans. We're basically a book club."
Idle (mid): "Come on, the code is right there. {code}. Four letters. You got this."
Idle (general): "Tick tock. I'm not getting any younger and neither is this trivia."

## Files touched

- new: `src/lib/lobby-banter.ts`
- `src/routes/host.tsx` — opener + 10s interval inside the existing lobby effect

## Out of scope

- New TTS voice or persona swap (uses current announcer)
- Banter on the join/player screen
- Configurable cadence / mute toggle (could add later)
