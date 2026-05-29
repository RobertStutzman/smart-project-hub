## Problem

On `/join`, the **Next** button stays disabled even when the user has typed a room code and nickname. The disable condition is `code.length !== 4 || !nickname.trim()`. Because the form gives no feedback about *which* condition is failing, it looks broken.

Likely root causes on mobile:
- iOS autofill adds whitespace to the nickname (`.trim()` then empties it).
- `onChange` fires only on blur for some iOS keyboard modes, so React state doesn't match what's visibly typed.
- The QR-prefilled `?code=` param contains a stray character that gets stripped to < 4 letters.

## Fix

Edit only `src/routes/join.tsx`:

1. **Live status line under the inputs** showing what's missing:
   - `Code: 3/4` (red) → `Code: 4/4 ✓` (green)
   - `Nickname: 0/20` (red) → `Nickname: 5/20 ✓` (green)
   This instantly tells the user (and us) which field is failing.

2. **Robustness on inputs**:
   - Add `onInput` handler mirroring `onChange` for the code field, so iOS keyboards that defer change events still update state.
   - Apply `.trim()` to nickname *on submit* (not just for validation) so leading/trailing spaces don't block.
   - Show the sanitized code value back to the user so they can see if a character was dropped.

3. **Loosen the gate slightly**: keep the 4-letter requirement (server enforces it), but base the nickname check on `nickname.trim().length >= 1` (already the case) and surface it visibly.

4. **Tap-anywhere fallback**: if the user taps Next while disabled, briefly flash the unmet-requirement line in red so they understand why.

No backend, schema, or other-file changes.
