## Why the home screen looks yellowish

In `src/styles.css`, the **light theme** base color is:

```
--background: oklch(0.96 0.03 85);   /* hue 85 = yellow → cream/paper */
```

The home page (`src/routes/index.tsx`) renders with `bg-background`, so when the app is in light mode it picks up that warm cream tone. The dark theme (`oklch(0.08 0.02 290)`, hue 290 = deep indigo) is what the game is designed around, but the app is currently falling back to light because `ThemeProvider` isn't forcing dark on the marketing/home route.

## Fix options (pick one)

1. **Force dark globally** (recommended for a "Beat the Drop" game-show vibe)
   - In `src/components/ThemeProvider.tsx`: change default theme to `"dark"` and add the `dark` class to `<html>` on mount.
   - Result: home, host, and play screens all render on the indigo-black base.

2. **Neutralize the light background only**
   - Change `src/styles.css` line 45 to `--background: oklch(0.98 0 0);` (pure neutral white) so light mode is crisp white instead of cream.
   - Keep dark mode untouched.

3. **Make the home page dark-only**
   - In `src/routes/index.tsx`, wrap `<main>` with `className="dark"` (or set `data-theme="dark"`) so just the landing page uses the dark palette regardless of system preference.

## Recommendation

Go with **Option 1** — force dark globally. The whole app (host TV, mobile controller, selfie shatter, leaderboard, AI roast) is designed for a dark stage aesthetic; a light/cream mode doesn't fit the product. We can keep the light tokens around for future use but stop auto-applying them.

## Files to touch (Option 1)

- `src/components/ThemeProvider.tsx` — default to `dark`, add `dark` class to `document.documentElement`, drop system-preference auto-detection (or gate it behind an explicit user toggle later).
- Optional: `src/routes/__root.tsx` — add `className="dark"` on the `<html>` shell as a belt-and-suspenders fallback for SSR's first paint so there's no yellow flash before hydration.

No other code changes needed.