## Host home screen: arrow nudge + all categories on

### 1. Animated arrow + nudge pointing at the Surprise Mix pill

Add an amber, hand-drawn-style SVG arrow with a small label sitting just above the `🎲 Surprise Mix · all 13 categories` button so hosts realize it's a control.

- **Label**: "Pick your categories" in small caps, amber-200.
- **Arrow**: inline SVG, curved/squiggly, amber stroke with subtle drop-shadow glow, pointing down at the pill.
- **Motion**: gentle bobble (~6px y-translate, 1.8s easeInOut loop) via `motion.div`.
- **Dismiss**: hide once the host opens Settings once. Persisted via `localStorage` key `dt:host:cat-nudge-seen=1`.
- Placed in `src/routes/host.tsx` immediately above the Surprise Mix button (around line 762), wrapped in `<AnimatePresence>`.

### 2. All categories on by default

- `src/lib/categories.ts`: change `DEFAULT_OFF_CATEGORIES` from `["Chapter & Verse"]` to `[]`.
- `src/routes/host.tsx`: bump the `CATEGORIES_KEY` localStorage value from `"dt:host:categories"` to `"dt:host:categories:v2"` so existing hosts get the new "all on" default once, then their choices persist normally.

### Out of scope
- No DB changes, no category list edits.
- Not touching the Settings sheet layout or the Surprise Mix pill styling itself.