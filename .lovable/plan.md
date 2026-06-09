Keep the nudge **sideways** (not below — that would collide with the players list / stage chrome underneath), but make it safe on narrow viewports.

In `src/routes/host.tsx` (~lines 781–825):

- **Default placement (≥640px):** sit to the **right** of the categories pill, arrow points left at it. Container: `absolute left-full top-1/2 ml-2 -translate-y-1/2 flex items-center gap-1.5`. Horizontal bobble stays (`x: [0, 6, 0]`) so it wiggles toward the pill.
- **Narrow viewports (<640px):** flip to the **left** of the pill (`max-sm:left-auto max-sm:right-full max-sm:ml-0 max-sm:mr-2`) and reverse the arrow direction (use `max-sm:rotate-180` on the SVG, or render a flipped variant). This guarantees it never runs off either edge.
- **Shorten the label** so it fits in the gutter: `"pick your categories!"` (drop the "psst — you can"). Less likely to overflow, still playful.
- **Keep:** amber drop-shadow glow, auto-dismiss on opening Settings, `CAT_NUDGE_KEY` v2.

Result: a fun sideways wiggling arrow that hugs the pill on either side depending on space, never overlapping the start button above or the player area below.