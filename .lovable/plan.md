I’ll fix the intro sequence at the source instead of tuning more delays.

Plan:
1. **Clear stale announcer audio when intro starts**
   - As soon as `IntroStage` mounts, hard-cancel the Elf voice queue so lobby/join callouts cannot sit ahead of the intro countdown.

2. **Make “Here we go!” own the handoff**
   - Play “Here we go!” as an interrupting, game-critical line.
   - Start the visual `3 → 2 → 1` countdown only after that line finishes, with a bounded fallback so it cannot hang forever.
   - Do not let a late queued “Here we go!” play after the countdown starts.

3. **Stop queuing countdown numbers behind unrelated audio**
   - Either interrupt/clear before each countdown cue or suppress stale countdown TTS if it misses its tick window.
   - The visual countdown remains authoritative: `3`, `2`, `1`, `GO` at exact 1-second intervals.

4. **Prevent first-question overlap**
   - Delay `onDone()` until the countdown sequence has fully completed.
   - Immediately cancel any remaining countdown/intro voice task before calling `nextQuestion`, so no `3/2/1` audio can start on the first question screen.

5. **Verify timing in code paths**
   - Check that the intro phase cannot advance to the first question until after `GO`, and that queued voice/audio is cleared at that boundary.