## Plan

1. **Stop layering multiple looped ambience files**
   - The landing page (`/`) and join page start `startLobbyChatter()`, which still uses the original `lobby-chatter.mp3` loop path.
   - The host page starts both `startLobbyChatter()` and `startCrowd()`, so even though the crowd file was replaced, the remaining chatter loop can still create the perceived “crowd noise” gap.
   - I’ll remove `startLobbyChatter()` from host lobby startup so the host crowd is only the seamless crowd bed.

2. **Make lobby chatter use the seamless bed too**
   - Point `startLobbyChatter()` at the same long seamless ambience asset, but at a lower volume.
   - Mark it as continuous Web Audio playback, not scheduled short-loop playback.
   - This prevents the home/join pages from using the old short MP3 loop that can still gap.

3. **Remove the old short-loop scheduler from ambience startup paths**
   - Keep the scheduler code only for non-critical one-off legacy layers if needed, but ensure normal ambience layers (`chatter` and `crowd`) use native continuous looping.
   - Keep autoplay retry behavior unchanged.

4. **Verify references**
   - Confirm no active page path starts `lobby-chatter.mp3` or `crowd-ambience.mp3` for background ambience.
   - Confirm host lobby only starts the seamless crowd bed.
   - Confirm the CDN-hosted seamless WAV is the only ambience source for continuous background noise.

## Technical notes

- The user-facing issue is described as “crowd noise,” but on `/` the actual active ambience is `startLobbyChatter()`, not `startCrowd()`.
- Previous fixes targeted `startCrowd()`, while `startLobbyChatter()` still used the old MP3 and scheduled crossfade loop. This plan removes that remaining source of gaps.