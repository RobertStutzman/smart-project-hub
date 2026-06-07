## Goal

Make the drop SFX and the debris burst land at the exact moment the falling tile would "hit the floor" — i.e. ~750ms after the elimination is triggered, not at the start of the fall.

## Current behavior

- `HostGameStage.tsx` line 332 calls `playRandomDrop()` immediately when a wrong answer is scheduled to drop.
- `QuestionStage.tsx` mounts `<DropDebris />` the moment `dropped` flips true.
- The tile's gravity fall animation takes ~750ms.

Result: sound and debris fire as the tile starts falling, then the tile silently sails off-screen.

## Change

Introduce a single shared constant `DROP_FALL_MS = 750` (the duration already used by the falling card's `motion.div` transition). Both call sites delay by that amount.

### `src/components/host/QuestionStage.tsx`

- Export `DROP_FALL_MS` constant from this file (or a new shared `drop-timing.ts` — exporting from QuestionStage is fine since HostGameStage already imports from it indirectly).
- Use `DROP_FALL_MS` in the falling card's `transition.duration` (replace the literal `0.75`).
- Per cell, track `impacted[i]` state. When `dropped` flips true, start a 750ms timer; when it fires, set `impacted[i] = true`. Render `<DropDebris />` only while `impacted[i]` is true (still wrapped in `AnimatePresence`).
- Clear the timer on unmount / when `dropped` flips back false (resets between questions).

### `src/components/host/HostGameStage.tsx`

- Import `DROP_FALL_MS` from QuestionStage.
- Replace `playRandomDrop()` at line 332 with `window.setTimeout(playRandomDrop, DROP_FALL_MS)`. Capture the timer ID in a ref array so it gets cleared if the question ends early (route change, host skip, etc.) — guard against orphan sounds after the question concludes.

## Files touched

- edited: `src/components/host/QuestionStage.tsx` — export `DROP_FALL_MS`, add per-cell `impacted` state with timer, gate `<DropDebris />` on it
- edited: `src/components/host/HostGameStage.tsx` — delay `playRandomDrop()` by `DROP_FALL_MS`, track timers in a ref for cleanup on unmount / new question

## Out of scope

- No changes to the SFX bank, weights, or the fall animation itself.
- No change to elimination scheduling logic (`DROP_AT_ELAPSED_S` thresholds remain the same).
