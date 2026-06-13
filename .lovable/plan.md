# Fix: End-game silence

## What broke
In `src/components/host/HostGameStage.tsx` (lines 599-608), the master music switch only starts a bed on `question / final_question / intro / credits / lobby / final_intro / final_wager`. **Every other phase falls through to `stopMusic()`** — including `reveal`, `leaderboard`, `final_reveal`, and `ended` (WinnerSpotlight).

Result: the moment the final answer is revealed, music stops. `playEvent("victory")` fires once on `ended` (line 688), then the WinnerSpotlight sits in silence until `credits` mounts and starts its own bed.

## Fix (scoped, no behavior changes elsewhere)

**File: `src/components/host/HostGameStage.tsx`** — only the music switch effect (lines 599-608) and the phase-sting effect (lines 670-689).

1. Keep the "tense" bed running through `reveal` and `final_reveal` instead of dropping to silence — no audible gap between question and reveal.
2. On `ended`, start `playCreditsMusic(0.42)` (louder than the credits' 0.22 duck) so WinnerSpotlight has a continuous celebratory bed. `credits` already calls `playCreditsMusic(0.22)`, so the handoff is seamless — same track, just ducks for the voiceover.
3. On `leaderboard`, keep the "lobby" bed at low volume instead of going silent.
4. Layer hype on `ended`: in addition to the existing `playEvent("victory")` sting, fire a `play("whoosh")` + a second `playEvent("victory")` at ~3.5s so the spotlight has two beats of excitement, not one.

No new sound assets, no changes to `sound-engine.ts`, `CreditsStage.tsx`, `WinnerSpotlight.tsx`, server functions, scoring, or any other phase.

## New switch (replaces lines 599-608)

```ts
if (state.phase === "question" || state.phase === "final_question" || state.phase === "reveal")
  startMusic("tense", 380);
else if (state.phase === "final_reveal")
  startMusic("tense", 380);
else if (state.phase === "intro")
  startMusic("lobby", 600);
else if (state.phase === "lobby" || state.phase === "leaderboard")
  startMusic("lobby", 600);
else if (state.phase === "final_intro" || state.phase === "final_wager")
  startMusic("tense", 520);
else if (state.phase === "ended") {
  // Celebratory bed under WinnerSpotlight; credits phase will duck it to 0.22.
  void import("@/lib/sound-engine").then((m) => m.playCreditsMusic(0.42));
} else if (state.phase === "credits") {
  // CreditsStage starts its own playCreditsMusic(0.22); don't fight it.
} else {
  stopMusic();
}
```

## Hype layer on `ended` (extends lines 688)

Replace the single-line `else if (state.phase === "ended") playEvent("victory");` with:

```ts
else if (state.phase === "ended") {
  playEvent("victory");
  const t1 = window.setTimeout(() => play("whoosh"), 1800);
  const t2 = window.setTimeout(() => playEvent("victory"), 3500);
  return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
}
```

## Verification
- Enter `ended` phase → music bed audible immediately, victory sting on entry, whoosh ~1.8s, second victory sting ~3.5s, bed continues.
- Transition `ended → credits` → no audio gap, no restart blip (`playCreditsMusic` already handles same-track reuse at lines 380-384 of `sound-engine.ts`); voiceover ducks the bed via existing `duckMusic`.
- Question → reveal → leaderboard: continuous music instead of silence between phases.
- No regressions on `lobby / intro / question / final_*`.
