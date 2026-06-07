Revert `src/components/AccessibilityToggle.tsx` so the high-contrast toggle defaults to OFF. The dark-blue Fellowship look is the default; high contrast stays opt-in. Also clear any stale `btd-a11y-contrast="1"` written during the previous default-on attempt by treating missing/`"0"` as off and only honoring an explicit `"1"`.

Single file change.
