## Goal
Strip the "Join at https://…lovable.app/join" line from the top of the host screen. The room code + QR are how people actually join; the URL is noise on TV/projector.

## Change
- `src/routes/host.tsx` lobby header: remove the "Join at <full URL>" text block.
- Keep the big room code, "Game PIN" label, and the QR code (which already encodes the join URL).
- The QR caption can stay as a short "Scan to join" — no full URL printed.

## Out of scope
- No layout reshuffle of the lobby beyond removing that one line.
- QR generation itself is unchanged.

## Files touched
- `src/routes/host.tsx`