Redesign the host lobby as a single-screen, no-scroll Jackbox-style layout that fits any TV viewport from 720p up.

## What Jackbox does (target)

- One screen, no scroll, ever.
- Huge centered room code + QR as the hero.
- "Join at jackbox.tv" line under the code.
- Player avatars appear in a row across the bottom as they join.
- No settings, toggles, theme pickers, or category grid on the lobby — the host advances with one button.

## Changes

1. Strip the lobby down to four things, top to bottom:
   - Brand line (small, top)
   - Hero block: "JOIN AT {host}/join" + giant room code + QR, all centered
   - Player avatar row (horizontal, wraps)
   - Single primary action button: "Start the show" (disabled until ready)

2. Move host controls off the lobby
   - Allow late joiners, team mode, theme, mute, category picker → behind a small gear icon button (top-right) that opens a slide-in panel/sheet.
   - Category picker stays required before starting, but lives inside the settings sheet with a "Pick category" call-to-action shown on the Start button when none selected.

3. Use viewport-safe sizing that actually fits Silk
   - Container: `height: 100svh`, no scroll, flex column.
   - All sizes clamp on `svh` (small viewport height) so Silk's chrome doesn't push content off.
   - Add 3-4% inset padding on all sides for TV overscan.

4. Remove the fixed top-right QR panel
   - The QR is now the hero in the center, no longer a corner pin.
   - Header (Home, Host view, Fullscreen, Admin, Settings gear) sits on a single thin top row.

5. Keep game stage screens unchanged
   - This redesign only touches the lobby phase. Question/reveal/scoreboard stages already render via `HostGameStage` and are untouched.

## Technical notes

- File: `src/routes/host.tsx`, lobby return block only (lines ~336-633).
- New small component (inline): `SettingsSheet` for the gear panel, using existing `Toggle` and category grid markup moved into it.
- Sizing: `text-[clamp(4rem,18svh,12rem)]` for the code, `size={Math.min(220, viewport-derived)}` for the QR via a `clamp`-style CSS approach (use fixed 200px — fits even at 720p once controls are removed).
- No new dependencies.

## Verification

- Preview at 1280x720 (Firestick): no scroll, QR + code + players + Start all visible.
- Preview at 1024x600 (low-end TV browser): same.
- Preview at 1920x1080: hero scales up, still no scroll.