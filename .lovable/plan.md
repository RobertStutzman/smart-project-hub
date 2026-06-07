## Plan

1. **Make TV/browser host view fit the screen**
   - Change the active host game wrapper from `min-h-screen` to a fixed viewport-height stage (`h-dvh`) with `overflow-hidden` so browser mode cannot grow beyond the visible screen.
   - Tighten `QuestionStage` spacing: smaller padding/gaps, responsive grid gaps, smaller timer ring on narrower browser windows, and clamped answer card/question text sizes.
   - Add `min-h-0` to the main stage/grid containers so answer cards shrink instead of forcing the page taller.
   - Reduce/contain final wager, final reveal, ended, and leaderboard screen typography/padding so those phases also stay on one browser viewport.

2. **Lower background music under voice**
   - Reduce synth background music gain significantly.
   - Clamp uploaded lobby music volume lower than its saved clip volume so it does not overpower voice.
   - Lower welcome/intro clip playback slightly.
   - Keep question TTS voice high and clear, and temporarily duck/pause background music while question TTS is speaking if needed.

3. **Verify the exact paths changed**
   - Review the edited files for syntax/layout consistency.
   - Avoid touching game logic, scoring, phone flow, or backend schema.