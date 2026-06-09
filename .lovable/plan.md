## Restore the "Pick your categories!" arrow permanently

The nudge already exists in `src/routes/host.tsx` but auto-hides after the host opens Settings once (tracked in localStorage). Remove the dismiss logic so the bouncing arrow + label always shows next to the Mix/category button on the lobby screen, every session, for every host.

### Changes

**`src/routes/host.tsx`**
- Remove the `catNudgeSeen` state (line 104) and its `localStorage` hydration (line 119).
- Remove the dismiss block inside `openSettings` (lines 124–127); keep the `setSettingsOpen(true)` call.
- Remove the `CAT_NUDGE_KEY` constant if no other references remain.
- Change the JSX guard `{!catNudgeSeen && (` (line 874) so the `<motion.div>` always renders.

No visual changes to the arrow itself — same SVG, same bounce animation, same amber styling. It just never disappears.
