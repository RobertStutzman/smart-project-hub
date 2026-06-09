## Plan

1. **Fix the spoken line selection**
   - Update the announcer line helper so it can tell the difference between:
     - absolute game question number (`1..20`), and
     - question number inside the current round (`1..5`).
   - Keep “Round N / New round” wording only for true round openers: questions `1`, `6`, `11`, and `16`.
   - Use normal “Question N” wording for all other questions.

2. **Fix the trigger guard**
   - Update the host-stage announcement effect so the “round intro” audio/sting logic is keyed by the actual question identity, not just the numeric counter.
   - This prevents duplicate or stale “new round” callouts after realtime updates, remounts, or phase transitions.

3. **Preserve wildcard behavior**
   - Wildcard questions (`5`, `10`, `15`, `20`) will still announce as wildcard moments, but not as a new round.
   - Final question behavior stays separate and unchanged.

## Technical details

- Files to change:
  - `src/lib/round-callouts.ts`
  - `src/components/host/HostGameStage.tsx`
- No backend/database changes.
- No changes to recap visuals or scoring.