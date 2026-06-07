## Change

In `src/routes/host.tsx` (lobby return block, ~line 319):

1. Outer `<main>`: `min-h-screen` → `h-dvh` + keep `overflow-hidden`.
2. Inner container: `min-h-screen` → `h-full`, and add `min-h-0` so the grid can shrink.
3. Grid section: add `min-h-0` so the players column scrolls internally instead of pushing the page.
4. Players `<ul>`: wrap in a `min-h-0 overflow-y-auto` pane so a large lobby doesn't blow out the layout.

No other files touched. No design-token, copy, or behavior changes — pure layout fit.

## Out of scope

In-game stages, font/QR sizing tweaks, play screen, admin. Those stay for a follow-up if the shell fix alone isn't enough.