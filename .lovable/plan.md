## Problem

The host screen overflows the TV viewport on Amazon Silk (the browser shipped on Fire TV / Fire tablets). Yesterday's pass tightened the layout for normal browsers, but it relies heavily on `svh` / `dvh` viewport units inside `clamp(...)` expressions. Silk's Chromium is older and does not understand `svh`/`dvh` — when a CSS value contains an unsupported unit inside `clamp()`, the whole declaration is dropped, so:

- `h-[100svh]` falls back to no height → page grows to content height instead of being capped to the TV viewport.
- `clamp(3rem, 16svh, 8rem)` and the dozens of similar font/size clamps become invalid → text renders at default size and blows past the screen.
- `maxHeight: "12svh"` on the lobby player chip row never clips, so the lobby list pushes the CTA off-screen.

That matches the "doesn't fit my TV screen" symptom: huge text, lobby list overflows, no scaling.

## Fix

Add plain-`vh` fallbacks everywhere we currently use `svh`/`dvh` so Silk gets a valid declaration. Strategy:

1. **Root containers** — replace `h-[100svh]` with `h-screen` (which is `100vh`) on `src/routes/host.tsx` line 608 and the side panel on line 860. `100vh` is universally supported and on a TV there is no dynamic browser chrome to worry about, so the `svh` precision isn't needed.
2. **Clamp expressions** — for every `clamp(min, Nsvh, max)` in `src/routes/host.tsx` (the title, code, QR, lobby chips, CTA button, hint line, etc.), swap the middle term to `Nvh`. Same for the few `1.2svh / 1.5svh / 3svh` gap and padding values. This is a mechanical find-and-replace inside this one file.
3. **Safe-area padding** — `calc(env(safe-area-inset-top, 0px) + 3svh)` becomes `calc(env(safe-area-inset-top, 0px) + 3vh)`.
4. **HostGameStage / QuestionStage** — already use `vh` (not `svh`), so no change needed there. Spot-check after the host.tsx edit to confirm nothing else uses `svh`/`dvh`.
5. **Viewport meta** — leave `width=device-width, initial-scale=1` as-is. Silk honors it; the bug is the unit, not the meta.

No behavior, copy, or visual design changes for modern browsers — `vh` and `svh` resolve to the same number on a TV (no collapsible chrome), so desktop/Chrome users see no difference.

## Verification

After the swap, load the host route in a normal browser to confirm the layout is visually identical, then ask the user to reload on the Fire TV. If anything still overflows on Silk it will be a specific component, not the global units, and we can target it.

## Out of scope

- No changes to game logic, announcer, credits, or the wrong-picks wall.
- No new responsive breakpoints or TV-specific stylesheet — just the unit fallback.
