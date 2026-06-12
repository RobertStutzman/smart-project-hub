# Boot tap-sound + landing announcer line

## 1. Replace the "push to play" sound

Today the gate button plays the synth `"whoosh"` (a single sawtooth sweep — that's the "cheap" sound). I'll add a new pre-built synth stinger called `"ignition"` and swap the boot gate to it. All Web Audio (no new assets to load).

**`src/lib/sound-engine.ts`**
- Add `"ignition"` to the `Sfx` type.
- Implement it as a layered stinger fired in one call:
  - Bright high riser (sine 600 → 3200 Hz, ~280ms)
  - Crisp transient click (white-noise burst, ~60ms)
  - Sub-bass impact (sine 90 → 38 Hz, ~450ms, generous gain)
  - Shimmer tail (triangle 1800 → 900 Hz, ~220ms)
- Net: ~700ms "vwooom-THUMP-shhh" — feels like an arena game show button hit, not a synth blip.

**`src/components/BootSequence.tsx`**
- Replace `play("whoosh")` inside `unlockAudioAndStart()` with `play("ignition")`.
- Leave the rest of the boot intro (music sting + Elf "Beat. The. Drop.") untouched.

## 2. Landing-page announcer line

My take: **yes, but very short and only the first time per session**, so returning visitors aren't nagged. After boot dismisses on the landing page, the Elf says one quick orienting line, then ambient lobby chatter takes over (already wired).

**`src/routes/index.tsx`**
- After `BootSequence` completes, fire a one-shot Elf line guarded by `sessionStorage.getItem("btd-welcome-said")` so it plays at most once per browser session.
- Delay ~600ms after `onComplete` so it doesn't collide with the boot "Beat. The. Drop." tail.
- Line (one of, picked randomly):
  - "Hosting tonight? Pick the big screen. Everyone else — grab your phone."
  - "Two ways in: host it on the TV, or jump in from your phone with a four-letter code."
  - "Big screen for the host. Phones for the players. Let's go."

If the user already saw the landing this session (e.g. navigated back from `/host`), no line plays — chatter continues uninterrupted.

## Verification
- Hard refresh → boot screen → tap → hear the new "ignition" sting instead of the thin whoosh, then boot music + "Beat. The. Drop." as before.
- Landing page appears → ~600ms later, Elf says the welcome line once.
- Refresh again in the same tab → boot replays but welcome line does NOT (session-cached).
