## Why it's silent

The boot sequence (`BootSequence.tsx`) opens automatically on first page load and auto-advances via timers. Browsers block ALL audio playback (both the crowd ambience and the ElevenLabs "How to play" announcer VO) until the user makes a gesture on the page. Because the boot intro never required a tap before it started, every `audio.play()` is rejected and the whole intro plays silently.

The previous "retry on any gesture" logic in `useLobbyChatter` does work — but only if the viewer actually taps. On a TV / first load nobody taps, so nothing ever unlocks.

## Fix

Add a "Tap / Press OK to begin" gate as the very first frame of the boot sequence. Once the viewer taps (or presses any key), that gesture unlocks the browser's audio policy and we then:

1. Start the seamless crowd ambience immediately (already wired via `startLobbyChatter`).
2. Pre-warm the "How to play" VO (`speakAsElf` cache fetch) so it's ready when the tips slide shows.
3. Begin the existing splash → credits → tips → ready flow with both ambience and announcer audible.

## Changes

**`src/components/BootSequence.tsx`**
- Add a new initial stage `"gate"` before `"splash"`.
- The gate renders a centered "Press any key · Tap to begin" prompt with the same dark grain background.
- The first keydown / pointerdown on the gate:
  - Calls `startLobbyChatter()` from `@/lib/ambience-engine` to unlock + start the crowd bed under the user gesture.
  - Fires `prewarmElfLines([TIPS_VO], "hype")` so the announcer audio is fetched while splash/credits play.
  - Transitions to `"splash"` and the rest of the boot flow runs as today.
- Tips stage continues to call `speakAsElf(TIPS_VO, ...)` — now it will actually play because audio is unlocked.

**No other files need changes.** `useLobbyChatter` on `/` keeps working as a safety net for users who skip the boot via `?nosplash=1` or sessionStorage.

## Notes
- This is the only reliable cross-browser way to make autoplay audio work — there's no way around the gesture requirement.
- The gate is the same "press any key to skip" affordance the user already sees, just promoted to a first-frame requirement so the rest of the intro has sound.
