## Goal

Replace the bright purple browser icon with an on-brand "BTD" monogram in the game's amber/gold gradient on the dark navy background.

## Changes

### 1. Generate three new PNG icons
Use the agent image tool (premium tier for legible typography) to produce a tight, square monogram:

- **Mark**: "BTD" in heavy display sans (black weight, slight negative tracking), centered.
- **Letter color**: amber-to-gold vertical gradient matching the wordmark — top `oklch(0.97 0.18 90)` → bottom `oklch(0.65 0.25 35)`.
- **Background**: deep navy `oklch(0.06 0.02 270)` with a faint warm rim glow at bottom.
- **Padding**: ~12% inset so the letters stay readable at favicon size.
- **No subtitle, no tagline, no extra glyphs.**

Saved at:
- `public/icon-512.png` (master 1024→512)
- `public/icon-192.png` (downscaled crop of same render)
- `public/apple-touch-icon.png` (180×180)

All three are the same artwork, sized differently. Generate the 512 first, then downscale via `nix run nixpkgs#imagemagick` to keep the mark pixel-identical across sizes.

### 2. Add a 32×32 favicon (optional polish)
The current setup only ships 192/512 PNGs. Browsers fall back to `/favicon.ico` requests; add a 32×32 PNG at `public/favicon.png` and register it in `src/routes/__root.tsx` (`{ rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" }`). Keeps the tab icon sharp.

### 3. Bump manifest cache
No code change needed to `manifest.webmanifest` — it already points at `/icon-192.png` and `/icon-512.png` by path. The new files replace the old in place, so existing references resolve.

## Out of scope
- Wordmark, splash screens, in-app branding — all untouched.
- `manifest.webmanifest` theme colors — review separately if the user wants the install/PWA chrome retinted.

## Result
Browser tab + bookmark + PWA install icon all show a clean amber-gold "BTD" on dark navy — matches the "Beat the Drop" wordmark and the dark game theme.
