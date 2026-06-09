## 1. Always show the landing boot splash

`src/components/BootSequence.tsx` — make the "Beat the Drop / Tap to begin" splash play on every visit to `/`, not just first per session.

- Stop writing the `btd:boot:done` sessionStorage flag on complete.
- Update `shouldShowBoot()` so it ignores the flag and just honors the existing `?nosplash=1` dev override.
- Keep the standalone‑PWA short‑circuit that skips the tap gate (so installed app launches don't strand the user on a gesture wall).

## 2. Slower, bigger 3‑2‑1‑GO at the start of round 1

`src/components/host/IntroStage.tsx` — keep the title card + contestants roster, then lean into a real countdown.

Timing (was 700ms per number; new ≈1s per number):
- Title card: 0 → 2600ms (unchanged)
- Roster: 2600 → 6200ms (unchanged)
- Countdown "3": 6200ms — speaks "Alright… here we go in three!" + tick
- Countdown "2": 7300ms + tick
- Countdown "1": 8400ms + tick
- "GO": 9500ms + whoosh
- onDone: 11200ms

Visuals: bump the countdown digit to `text-[34vw] sm:text-[24vw]` (was `28vw/20vw`), thicken the drop‑shadow glow, and tighten the enter/exit so each number snaps in (0.25s enter, 0.2s exit) instead of cross‑fading mushily. The "Get ready" eyebrow stays.

## Out of scope

- `HowToPlay.tsx` — leaving the existing slides as‑is per your call.
- Per‑question "Get Ready / Question N" splash stays as‑is (project rule: no giant 3‑2‑1 before each question — this change is only for the game‑start intro).
- `HostOnboarding.tsx` is unused in the app today; leaving it untouched.
