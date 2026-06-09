## Lobby header overlap fix

The header ("← Home" / "Beat the Drop" / Settings) is `flex-none` at the top of a `flex-col h-full` container. Below it the HERO section is `flex-1 justify-center` and stacks "Game PIN" label + giant PIN (`clamp(4rem, 22svh, 12rem)`) + QR card (`clamp(140px, 28svh, 240px)` square) + optional category line + a `gap-[2svh]` between each. Add the player row, Start button, mix-label button below, plus 3svh TV-safe padding top/bottom.

On TVs at 1080p those clamps add up to roughly 22svh + 28svh + chrome ≈ 60+ svh just for the hero; combined with the player section (~24svh) the column exceeds 100svh. Because the hero is `flex-1 justify-center` with no overflow clip, the oversize content bleeds *up* past the header — that's the "Beat the Drop" overlapping the "Game PIN" line.

### Fix: shrink + clip the hero so it can never exceed its slot
`src/routes/host.tsx`, lobby render only:

- HERO `<section>` (line 672): add `overflow-hidden` and a tighter top spacer so it can never bleed under the header. Reduce the inter-row gap from `gap-[2svh]` to `gap-[1.2svh]`.
- PIN number (line 678): drop clamp from `clamp(4rem, 22svh, 12rem)` → `clamp(3rem, 16svh, 8rem)`. Still huge, but leaves room.
- QR card (lines 684-685): drop clamp from `clamp(140px, 28svh, 240px)` → `clamp(120px, 22svh, 200px)`.
- "Game PIN" label (line 673): drop max from `1rem` → `0.85rem` and tighten letter-spacing slightly so it doesn't crowd the giant number above it.
- Header (line 631): add a thin bottom margin / `pb-[1svh]` so even at the smallest TV-safe height there's a visible gap between header chrome and the hero content top.

No behavioral changes — pure CSS layout tightening on the lobby route. Player row, Start button, settings, modals, and the in-game stages are untouched.

### Out of scope
- The in-game (`HostGameStage`) layouts.
- Category picker modal.
- Mobile player view.
