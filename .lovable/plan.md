## Problem

On phones, the player screen (`src/routes/play.tsx`) is a fixed `h-screen` flex column with no scroll. When stacked content exceeds the viewport the answer tile grid (`flex-1`) is squeezed and its bottom row gets cut off. Two cases triggered it:

1. **Question phase** — a long question text in a `line-clamp-4` block can eat ~6 lines of vertical space, leaving the 2×2 tile grid too short to show all four tiles fully on small phones.
2. **Reveal phase** — the same grid is still mounted, *plus* the +score result panel, "Next question incoming…" line, and the "Did you know?" amber box are appended below. Long explanations push everything off-screen.

## Fix

Keep the page itself non-scrollable (so people don't accidentally swipe past the tiles), but make the content adapt so the answer grid is always fully visible.

### A. Question phase

- Tighten the question card: drop from `line-clamp-4` + `text-base` to a fluid `line-clamp-3` with `text-sm sm:text-base`, smaller vertical padding (`py-2`), and a max-height with internal scroll (`max-h-[18vh] overflow-y-auto`) so a wall-of-text question scrolls inside its own card instead of stealing height from the tiles.
- Give the AnswerGrid wrapper a guaranteed minimum height (`min-h-[42vh]`) so the tiles can never collapse below readable size.

### B. Reveal phase

- Move the "Did you know?" amber box into a single bottom panel that *replaces* the answer-grid wrapper on reveal once the result+score row has been shown for a moment, OR (simpler) make it a vertically-scrollable column below the grid with `max-h-[28vh] overflow-y-auto`, smaller padding, and `text-base` instead of `text-lg`.
- Reduce the +score panel's padding (`px-3 py-2`, smaller score type) so reveal-state stacking fits.
- Drop the "Next question incoming…" line when an explanation is showing (it's redundant with the auto-advance).

### C. Container

- Switch `main` from `h-screen` to `h-[100dvh]` so iOS Safari's URL bar collapsing doesn't shave 60px off the layout.
- Add `min-h-0` to the question-phase wrapper so flex children actually shrink correctly inside the column.

## Files touched

- `src/routes/play.tsx` — question-card sizing, reveal-panel sizing, container height, conditional "Next question incoming…".
- (No changes to `AnswerGrid.tsx`; sizing is driven by parent.)

## Verification

Dry-run on a 375×667 viewport (small phone) with:
- A long 3-sentence question + 4 long answer labels → confirm all four tiles visible and tappable.
- Reveal phase with a 2-sentence "Did you know?" → confirm tiles + result + explanation all visible (explanation scrolls internally if it overflows).
- Reveal phase with a short explanation → confirm no awkward empty space.