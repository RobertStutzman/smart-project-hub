## Issue #2 — QR/join + selfie screens use the dark blue game theme

**What's happening:** `src/routes/join.tsx` (both the code-entry "form" step and the "selfie" step) renders with `bg-background text-foreground`, which under the Fellowship theme is parchment-light. Players see white screens until they hit `/play`, which has the dark navy + amber gradient.

> Note: players scan the host's QR → land at `/h/<code>` → forward to `/join`, so "the QR code page" = the join code/name screen. If you actually meant a different screen, tell me.

## Fix

### `src/routes/join.tsx`
- Replace the outer `<main className="min-h-screen bg-background text-foreground">` with the same dark gradient wrapper `play.tsx` uses (`oklch(0.06 0.02 270)` deep-navy base + amber radial accent at top), so the join + selfie steps match the in-game look.
- Recolor the form card, input borders, status chips, and the primary "Join" button to the amber-on-navy palette (border `amber-300/30`, `bg-white/5` card, amber gradient CTA) so they're legible on the dark background.
- Recolor the "Take a selfie" heading + helper text to light tones.

### `src/components/SelfieCapture.tsx`
- Swap the parchment-leaning `border-border` / `bg-card` action buttons (Retake / Skip) to dark-theme equivalents (`border-amber-300/30`, `bg-white/5`, `text-amber-100`). Camera tile stays black (it's the viewport).

## Not changing
Game logic, navigation flow, copy, layout structure, or the Fellowship theme tokens themselves.

## Result
Scanning QR → join form → selfie → lobby all share the same deep-navy + amber palette. No more white shock on phone.