## Goal

On the QR/lobby screen, the announcer should NOT explain the rules. It should:
1. Say a one-shot "scan the QR code" prompt shortly after the lobby loads.
2. Continue with the existing ~10-second rotating idle quips (kept).

Rules-explanation stays on the next screen (HowToPlay slides, already wired to narrate via `speakPersona`).

## Changes

### 1. `src/lib/lobby-banter.ts`

- Replace `OPENER_LINES` with a single, focused set of "scan the QR / type the code" prompts (3–5 variants). These are pure call-to-join lines — no scoring, streaks, rules, or wager talk.
- Audit `IDLE_*` pools and `IDLE_GENERIC`: remove any line that veers into game mechanics. Current pools are already mostly waiting-room banter ("crickets", "tick tock", "{count} brave soul"); these stay. The ones that mention the code (e.g. "Code is {code}. Stragglers…") are fine — they're join prompts, not rules.
- Keep `pickOpener()` and `pickLobbyLine()` signatures unchanged.

### 2. `src/routes/host.tsx` — lobby announcer effect (~lines 383–426)

- Keep the opener call (`speakPersona(pickOpener(), …)`) firing once ~2.4s after mount. With the new opener pool, it now says a scan prompt instead of a generic hype line.
- Keep the existing `setInterval(tick, 10_000)` rotating quips exactly as-is.
- No other behavior changes.

### 3. No other files touched

- `HowToPlay.tsx` already narrates each slide — that's where the rules live. Untouched.
- `IntroStage.tsx`, `HostGameStage.tsx`, join roll-calls, ambience — untouched.

## Result

QR screen: welcome clip → crowd ambience → one "scan the QR code" opener → idle quips every ~10s (kept). Click Start → HowToPlay slides narrate the rules. Then the game begins.
