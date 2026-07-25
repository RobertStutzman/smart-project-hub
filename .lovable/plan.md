Plan to fix the repeated “Load failed” bake errors:

1. Add one safe “Bake Everything” runner
- Replace the confusing pile of overlapping bake buttons with a single safe batch button for the common flow.
- Run the bakes sequentially instead of all at once, so the browser/backend/provider do not get flooded.
- Keep individual advanced buttons available, but disable conflicting ones while a bake is running.

2. Make each bake call smaller and more resilient
- Reduce persona/question/explanation batch sizes from larger chunks to safer smaller chunks.
- Add short pauses and retry handling for transient fetch/provider failures.
- Make the UI continue after one failed line instead of making the whole job feel broken.

3. Surface the real failure reason
- Change the admin toast/progress text so “Load failed” becomes something actionable like provider rate limit, auth/session expired, storage upload failed, or network timeout when that detail is available.
- Show recent failed slots/line IDs in the progress area so you know whether it is a few bad lines or everything failing.

4. Keep adult content gated
- Ensure the adult Elf and Sasha bake buttons only generate adult-only storage categories and do not alter the standard game flow.
- Keep standard Elf content separate from adult-only content.

5. Verify
- Open `/admin-sounds`, confirm stats load, click the safe runner with a tiny test limit first, and verify it progresses without throwing “Load failed”.
- Confirm the page disables conflicting buttons while the job is running and displays useful progress/errors.