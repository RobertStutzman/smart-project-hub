## Announcer silent on final answer — root cause

The explanation-TTS player in `HostGameStage.tsx` (lines 343-403) hard-checks `phase === "reveal"` before playing `current_explanation_tts_url`. The final round uses `phase === "final_reveal"` instead, so the effect never runs and the announcer stays quiet — even though `startFinalRound` already baked the same `current_explanation_tts_url` URL into the room state (line 811 of `game.functions.ts`).

## Fix
Make the existing explanation-TTS effect treat `final_reveal` the same as `reveal`.

In `src/components/host/HostGameStage.tsx`:

1. Line 351 — change
   ```
   if (!qid || !url || phase !== "reveal") return;
   ```
   to
   ```
   if (!qid || !url || (phase !== "reveal" && phase !== "final_reveal")) return;
   ```

2. Line 391 — change
   ```
   if (state?.phase !== "reveal") {
   ```
   to
   ```
   if (state?.phase !== "reveal" && state?.phase !== "final_reveal") {
   ```

Everything else (the 3.8 s delay so the answer slam lands first, music ducking, the `lastPlayedExplanationIdRef` gate keyed by question id) already works for the final round — it just never runs today because of the phase guard.

## Out of scope
- No new TTS generation, no server-fn changes.
- No layout/UI changes to `FinalRevealStage`.
- Sudden-death reveal stays as-is (no explanation TTS associated).
