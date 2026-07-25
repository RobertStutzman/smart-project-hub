# Add Visible Adult Mode Entry Points

Note: this work was already completed in the prior turn. Re-issuing the plan for approval; no additional edits needed if you accept as-is.

## Changes

1. **Home footer link** — `src/components/LegalFooter.tsx`
   - Add a rose-tinted `🔞 Adult Mode` link pointing to `/settings/adult`.
   - Footer renders on the landing page (`/`), so it appears on home automatically.

2. **Host pre-game (lobby) link** — `src/routes/host.tsx`
   - Add a prominent `🔞 Adult Mode` link button inside the lobby settings sheet (around lines 1233–1243) so hosts can jump straight to `/settings/adult` before starting a room.

## Behavior

- Clicking either link routes to the existing `/settings/adult` page, which already handles the age + terms double-confirmation and persists the toggle in `sessionStorage` (`btd-adult-mode`).
- No changes to persona logic, baking, or voice IDs — purely visibility/entry-point wiring.

## Verification

- Typecheck passes.
- Manual: load `/` → footer shows the link; open host lobby settings sheet → link is visible and navigates correctly.