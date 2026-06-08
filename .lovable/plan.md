# Player-side wildcard parity

## Problem
Player phone only reflects `lightning`, `saboteur`, `glitch`, `roast` wildcards. The three new ones — `double_or_nothing`, `first_blood`, `underdog` — show nothing, so players don't know the scoring rules just changed.

## Approach
Reuse the existing top status bar in `src/routes/play.tsx` (lines ~652–690). It already swaps styling for `lightning`. Extend that same pattern to the new three so the wildcard label + rule sits inline next to the timer — no extra row, no layout shift on small screens.

## Changes

**`src/routes/play.tsx`** — top bar block (~lines 652–671):

Replace the hardcoded lightning branch with a small `WILDCARD_TOP` config map:

| wildcard | label shown | accent |
|---|---|---|
| lightning | ⚡ Lightning · 2× pts · 8s | rose (existing) |
| double_or_nothing | 💀 Double or Nothing · 2× / −150 | rose |
| first_blood | 🩸 First Blood · fastest only | red |
| underdog | 🐢 Underdog · last place 2× | emerald |
| roast | Roast vote · check TV | (unchanged) |
| (none / others) | Q# · Round # | default |

The bar keeps the same shape: pulsing accent border + bold label on the left, ticker + countdown on the right. Lightning keeps its current behavior exactly; the others get an equivalent accent (no animate-pulse on quieter wildcards — pulse stays exclusive to lightning since it implies urgency).

No new component needed; keep it inline since the styling is already inline here.

## Out of scope
- Host-side banner (already shipped).
- Saboteur/glitch player UI (already have dedicated panels lower in the layout).
- Wildcard rule explainers in lobby (separate feature if you want it).

## Verify
1. Run through Q5/Q10/Q15/Q20 — confirm phone top bar reflects the wildcard for each.
2. Confirm lightning still pulses rose (no regression).
3. Confirm normal questions still show `Q# · Round #`.

## Files touched
- `src/routes/play.tsx` — single inline block in the question/reveal branch.
