## Make "Bake question voiceovers" run until done (no 100 cap)

The Explanation panel already auto-loops batches until everything's baked. The Question panel does one batch of 100 and stops, which is why you have to keep re-clicking. Make it match.

### Edit `src/routes/_authenticated/admin-sounds.tsx` — `QuestionVoiceoversPanel`

Replace `runBake` with a loop that mirrors `ExplanationVoiceoversPanel.run`:
- Compute `remaining = stats.total - stats.baked` (or full `total` when `force`).
- `toast.loading(...)` with live progress: `Narrating questions… X / N`.
- `while (safety++ < 200)` call `bakeAllFn({ data: { force, limit: 25 } })`, accumulate `totalBaked` and `totalErrors`, update toast + `setProgress`, break when `r.total === 0` or `r.baked === 0` (no more left to do).
- On finish, `toast.success` and `refresh()` stats.

Button label changes:
- `🎤 Bake missing (100 at a time)` → `🎤 Bake all missing questions`
- Keep "Re-bake ALL (overwrite)" button; routed through the same loop with `force: true`.

Confirm dialog updated to: *"Bake all missing question voiceovers? Calls ElevenLabs once per question (~80 chars each). Runs automatically in batches until done — leave this tab open."*

### Server side — `src/lib/announcer.functions.ts`
No change needed. `bakeAllQuestionTTS` already accepts `limit` up to 500 and the loop uses 25/batch so each call stays well under the Worker request budget. Keeps the 250ms ElevenLabs spacing.

### Out of scope
- Not changing voice, model, or per-question text.
- Not touching the cost circuit-breaker (`TTS_CAP_PER_GAME`) — that's the live in-game cap, separate from this bake.
- Not removing the safety counter; 200 batches × 25 = 5000 questions ceiling, plenty of headroom.