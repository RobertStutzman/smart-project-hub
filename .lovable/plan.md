## Goal
Eliminate the audible crowd-noise gap at the loop boundary by stopping reliance on `AudioBufferSourceNode.loop = true`, which still hard-restarts the same file.

## Plan
1. **Replace the native loop for continuous ambience**
   - Change the `continuous` crowd/chatter path in `src/lib/ambience-engine.ts` so it runs two alternating Web Audio buffer sources.
   - Each source will play almost the full crowd file, fade out near the end, and overlap with the next source fading in.
   - This means the browser never hits a hard file restart that can expose silence at the end/start of the asset.

2. **Keep only one active crowd bed**
   - Make `startLoop()` idempotent and ensure the retry path on `/host` does not repeatedly stop/restart the crowd bed after it has already begun.
   - Keep the existing `stopAllAmbience()` before the initial host start, but make interaction retries call `startCrowd()` without forcibly resetting a currently playing layer.

3. **Use trimmed loop bounds for the crowd file**
   - Add a small safety trim at the start/end of the seamless crowd asset and a longer overlap crossfade.
   - This avoids any baked-in silence, encoder padding, or quiet tail being audible even if the file itself is not perfectly loopable.

4. **Verify active sources**
   - Confirm `/host` only starts `startCrowd()` for lobby ambience.
   - Confirm home/join use the same crossfaded engine at lower volume.
   - Confirm no active background path uses the old short MP3 loop or a hard native audio loop for the crowd bed.