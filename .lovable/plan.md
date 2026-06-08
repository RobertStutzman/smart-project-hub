## Issue #3 — Show rules only once (on Start)

**What's happening:** Rules appear twice:
1. `BootSequence.tsx` has a `TipsStage` shown on first visit to `/`.
2. `host.tsx` opens the `HowToPlay` modal when the host clicks Start.

You want only the Start one.

## Fix

### `src/components/BootSequence.tsx`
- Remove `TipsStage` from the stage list, delete its component definition and the `TIPS` constant. Boot keeps the logo/intro animation then completes through to the homepage — no rules cards on first visit.

### `src/routes/host.tsx`
- No change. The `HowToPlay` modal on Start stays the single source of rules.
- Keep the `HOWTO_KEY` sessionStorage check (rules don't reappear if host starts a second game in the same browser session).

## Result
First visit to homepage: just the logo/intro, no rules. Host clicks Start: HowToPlay rules deck appears once, then game begins.