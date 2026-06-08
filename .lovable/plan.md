## Plan

1. **Stop using the old 22-second ambience path**
   - Remove any remaining reliance on the original crowd MP3 behavior and avoid scheduling it in short loop cycles.
   - Disable the drumroll loop during lobby if it is contributing a repeating gap, because it is also a looped ambience layer and can sound like the crowd dropping out.

2. **Use one long, seamless crowd bed**
   - Generate/export a properly seamless crowd ambience file with the silent edge removed.
   - Upload it through Lovable Assets so the repo does not keep a large WAV binary.
   - Reference the generated `.asset.json` from the ambience engine.

3. **Simplify the crowd playback logic**
   - For the crowd layer, play the long seamless bed as a single continuous Web Audio loop with a safe internal loop window, instead of repeatedly scheduling overlapping 20–22s source instances.
   - Keep the existing autoplay-block retry behavior intact.

4. **Verify the actual timing**
   - Check that the final referenced file is not the original `crowd-ambience.mp3`.
   - Measure the produced audio and confirm there is no volume drop at the old ~22s point or at the new loop seam.

## Technical notes

- The current code still has multiple lobby ambience layers (`crowd`, `drumroll`, `chatter`). Since the reported gap is every ~22 seconds and previous crowd-only fixes did not change the heard result, the implementation should remove ambiguity by making the lobby buildup crowd-only first, then optionally reintroduce drumroll later as a one-shot/swell if needed.
- The generated audio should be externalized with `lovable-assets create`, leaving only a `.asset.json` pointer in `src/assets/audio/`.