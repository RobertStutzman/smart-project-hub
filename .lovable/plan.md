Plan to verify and fix the countdown timing properly:

1. Establish exact timing checkpoints
   - Capture timestamps for these visible states: intro mount, “Here we go!”, `3`, `2`, `1`, `GO`, first question mount, question text reveal, answer reveal.
   - Acceptance target: `3 → 2 → 1 → GO` at 1.0s intervals, and the first question must not mount until after `GO` has displayed and intro voice has been cleared.

2. Run browser verification on the live preview
   - Use Playwright against the running app, not just source inspection.
   - Automate a host start flow and record DOM/visual state transitions frame-by-frame.
   - Save screenshots/timestamps for each countdown state and the first question state.

3. Test slow-device behavior
   - Re-run the same flow with CPU throttling enabled to simulate a slow laptop/mobile-class device.
   - Verify timers remain based on elapsed time, not delayed animation completion or ElevenLabs latency.

4. Test repeated transitions
   - Repeat the start/intro/first-question sequence multiple times where possible.
   - Advance through at least a few question/leaderboard transitions to confirm no stale `3/2/1` audio or visual state appears in later rounds.

5. Fix only if verification shows drift
   - If the countdown is late, skipped, or overlaps the first question, adjust the source so the intro uses a single monotonic timeline and a guarded `onDone` handoff.
   - If slow devices drop animation frames, keep the visual state deterministic by deriving the displayed countdown from elapsed time instead of chained timeouts.

6. Report actual measured results
   - Provide measured timings, pass/fail against the target, and any code changes made if the verification exposes a real issue.