## Verify the live QR/join flow works end-to-end

I'll run a full check against the **published** site (droptrivia.app), not local, to confirm the customer path works before touching anything else. No code changes in this plan — verification only.

### Steps

1. **Published host page loads** — Open `https://droptrivia.app/host`, confirm room code + QR render, capture screenshot.
2. **QR target is correct** — Read the QR's encoded URL, confirm it points to `https://droptrivia.app/join?code=XXXX` (not localhost, not preview host).
3. **Join page loads from QR URL** — Open that exact URL in a fresh browser context, confirm nickname form renders (no "This page didn't load").
4. **Join submits successfully** — Enter a nickname, submit, confirm redirect to `/play` with no crash.
5. **Play page renders** — Confirm the player lands on `/play` and sees the waiting/game UI.
6. **Host sees the player** — Back on `/host`, confirm player count incremented.
7. **Report results** — Screenshots + pass/fail for each step. If anything fails, I'll show the exact error before proposing a fix.

### Non-goals

- No code changes.
- No `/dev` work.
- No republish unless step 1–6 reveals a bug that requires it.
