## Changes

1. **Lock theme to Fellowship.** Drop Synthwave & Sanctuary throughout.
   - `src/lib/theme.ts` — `THEMES = ["fellowship"]`; drop entries from `THEME_META`.
   - `src/styles.css` — remove the `[data-theme="synthwave"]` and `[data-theme="sanctuary"]` blocks (incl. `::before` overlay).
   - `src/components/ThemeParticles.tsx` — remove the synthwave/sanctuary branches; keep only fellowship.
   - `src/routes/host.tsx` — remove the Theme picker section (lines ~783–802) in the host settings drawer since there's nothing to pick anymore.
   - Leave `data-theme="fellowship"` on `<html>` in `__root.tsx` and the existing `setConfigFn({ theme })` push (now always fellowship) — no DB schema change needed.

2. **Default the player phone to high contrast.**
   - `src/components/AccessibilityToggle.tsx` — when no `btd-a11y-contrast` value is stored, default to `true` (apply on first paint and persist `"1"`). Existing users who toggled it OFF still keep their choice.

## Out of scope
No DB migration (existing `rooms.theme` column stays, values remain 'fellowship'). No changes to admin sound packs or i18n strings.
