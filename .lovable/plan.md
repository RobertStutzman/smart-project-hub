## Problem

In the host screen top bar, "Beat the Drop" looks slightly off-center because the bar uses `flex justify-between` with three auto-width groups: left ("← Home"), middle (title), right (fullscreen + Settings). The right group is wider than the left, so `justify-between` pushes the middle group off true center.

## Fix

In `src/routes/host.tsx` (around line 716), restructure the `<header>` so the title is anchored to the visual center of the bar regardless of the left/right group widths.

Approach: switch the header from `flex justify-between` to a 3-column grid with equal side columns:

- `grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-[1vh]`
- Left group: keep `← Home` button, wrap in a `div` with `justify-self-start`
- Middle: the "Beat the Drop" title with `justify-self-center` (true center of the bar)
- Right group: keep fullscreen + Settings buttons, wrap in a `flex items-center gap-2 justify-self-end`

No changes to button styles, behavior, fonts, or spacing — purely a layout swap so the title is mathematically centered.

## Scope

- One file: `src/routes/host.tsx`
- Only the `<header>` element in the TV-safe wrapper (around lines 716–746)
- No other components, styles, or logic touched
