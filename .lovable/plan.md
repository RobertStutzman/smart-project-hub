## Final round QA — gaps found

Three concrete dead ends in the chain:

1. **The "Final Round" splash never plays.** `startFinalRound` in `src/lib/game.functions.ts` writes `phase: "final_wager"` directly, so the dramatic `final_intro` stage in `HostGameStage.tsx` (lines 643-668) is dead code. Players jump straight into wagering with no dramatic beat.
2. **Phone has no `final_intro` state** — `src/routes/play.tsx` lumps `final_intro` and `final_wager` together, so the wager UI flashes up before the host's splash even animates in.
3. **Winner Spotlight can sit forever.** The `ended` phase requires the host to manually click "Roll credits". If the host walks away, the game never gets to the credits scroll or play-again button.

## Changes

**A. `src/lib/game.functions.ts` (line 708)** — change `phase: "final_wager"` → `phase: "final_intro"` inside `startFinalRound.handler`. All other writes (question text, answers, media, TTS) stay the same so we don't have to reload when we flip to wager.

**B. `src/components/host/HostGameStage.tsx` — final-round orchestrator (lines ~415-437)** — add a new branch: when `phase === "final_intro"`, fire a 4.5s timer and call `setPhaseFn({ phase: "final_wager" })`. Uses the same `finalAdvancedRef` keyed by `intro-${state.id}` to prevent double-fires.

**C. `src/routes/play.tsx` (line 492)** — split the conditional. When `phase === "final_intro"`, render a dedicated splash card ("★ Final Round" + "One question. All on the line." + pulsing "Get ready…"). When `phase === "final_wager"`, render the existing `PlayerWagerStage` as today.

**D. `src/components/host/HostGameStage.tsx` — ended-phase auto-advance** — add a 20s timer that auto-fires "credits" if the host doesn't click. Gives them plenty of time to read the spotlight + roast but rescues abandoned games.

No DB/schema changes. No new components — just rewiring existing stages.