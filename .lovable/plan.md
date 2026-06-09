## What’s probably glitching
The announcer works because it uses normal browser audio, but the lobby music/crowd path is split across Web Audio plus normal audio. Right now the global first-click unlock only fires once and can happen before `/host` has actually requested the crowd layer, while lobby music also silently gives up if the browser blocks `audio.play()`.

## Plan
1. Make audio unlock reusable instead of one-and-done
   - Keep global gesture listeners active until audio is confirmed usable.
   - Also retry on later clicks/keys if the first gesture happened too early.

2. Track and retry blocked lobby music
   - Remember when lobby music was requested but blocked.
   - On the next valid user gesture, resume/restart the current music mode instead of failing silently.

3. Make ambience retry deterministic
   - Keep the requested crowd/chatter/drumroll layer state.
   - After unlock, call the existing retry path and only clear blocked state when the context is actually running.

4. Simplify the host fallback listener
   - Avoid duplicate competing retry handlers in `/host`.
   - Let the shared audio unlock manager handle music and crowd consistently.

## Technical files
- `src/lib/sound-engine.ts`: add pending music retry state and export a retry helper.
- `src/lib/ambience-engine.ts`: tighten blocked-state handling around resume/retry.
- `src/routes/__root.tsx`: update global pointer/key/touch unlock to retry both engines until they actually start.
- `src/routes/host.tsx`: remove the fragile late fallback and rely on the shared unlock path.