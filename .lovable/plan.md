## Goal

On game 2+ (any IntroStage that runs after the host has finished at least one game in this session), have the announcer drop a fun "welcome back" one‑liner over the title card instead of the normal `intro_hype` line.

## Changes

### 1. New quip pool

Add a `WELCOME_BACK_LINES` array to `src/lib/host-persona.ts` (lives alongside the existing `LINES` map). ~6 short, dry/punchy lines, e.g.:
- "Back for more, huh? Let's do it again."
- "Round two. Same chaos, fresh questions."
- "Couldn't stay away. I respect that."
- "Welcome back, contestants. The drop is hungry."
- "You again? Good. I was just warming up."
- "Rematch incoming. No mercy this time."

Export a `pickWelcomeBack()` helper that returns a random line.

### 2. Track "this is a replay intro" on the client

In `src/components/host/HostGameStage.tsx`, the existing `playedOnceRef` already flips true the first time we leave lobby in this room. Read a window flag the same way we did for the replay lobby:

When the ambience effect detects `state.phase === "lobby" && ambienceHandedRef.current` (the Play Again branch), set:
```ts
(window as any).__btdReplayIntro = true;
```
alongside the existing `__btdReplayLobby` flag. This survives until the next IntroStage reads it.

### 3. Swap the intro line in `src/components/host/IntroStage.tsx`

In the mount effect, instead of unconditionally `speakPersona(pickLine("intro_hype", ...))`:

```ts
const replay = (window as any).__btdReplayIntro === true;
if (replay) {
  (window as any).__btdReplayIntro = false;
  speakPersona(pickWelcomeBack(), { preset: "hype", interrupt: true });
} else {
  speakPersona(pickLine("intro_hype", players.length));
}
```

Keep all other timing/visuals identical — the title card, roster, 3‑2‑1‑GO sequence we just tuned stays exactly as is.

## Out of scope

- No changes to the replay lobby (still silent per the previous request).
- No name‑drops or rematch‑count references (user picked the rotating quip option).
- No new sounds — reuses existing persona TTS path.
