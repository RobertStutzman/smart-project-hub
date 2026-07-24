# Apply 5 fixes to `src/lib/game.functions.ts` (`endQuestion`)

All changes are scoped to the `endQuestion` handler.

## Fix 1 — Prevent double-scoring (CRITICAL)
- After the existing `if (!room.question_started_at) return { ok: false };` (line 441), add a phase guard: `if (room.phase !== "question") return { ok: false, alreadyScored: true };`
- Reorder the end of the handler so the **reveal write happens before per-player score writes**, and make it a compare-and-swap by adding `.eq("phase", "question").select("id")`. If zero rows returned, bail with `{ ok: false, alreadyScored: true }`.
- New handler tail order: compute updates → First Blood → Heist → **CAS reveal** → batched player writes (Fix 2) → question-stats write.

## Fix 2 — Batch per-player writes
- Replace the sequential `for (const u of updates) { await supabaseAdmin.from("players").update(...).eq("id", u.id); }` loop with:
  - A `.map(...)` that still tallies `qAnswered / qCorrect / qResponseMs` and builds an array of rows.
  - A single `await Promise.all(updates.map(u => supabaseAdmin.from("players").update({...}).eq("id", u.id)))`.
- Choosing `Promise.all` over `upsert` because `players` has NOT-NULL columns (`room_id`, `session_id`, `nickname`, etc.) whose full set isn't guaranteed to be safe to re-write; `Promise.all` keeps the exact same update semantics while collapsing latency to one round-trip. Throw on the first error.

## Fix 3 — Cap stacked multipliers at 3×
- Add a top-level constant `const MAX_ROUND_MULTIPLIER = 3;` near the other scoring constants.
- In the `picked === correctIdx` branch (around line 571–580), capture `rawBase` before the multiplier chain and after all multipliers apply, clamp with `base = Math.min(base, rawBase * MAX_ROUND_MULTIPLIER);`.

## Fix 4 — Count Roast + Saboteur participation
- In the `if (isRoast)` branch (~line 534): add `if (typeof picked === "number") answered += 1;`
- In the `else if (isSaboteur && p.session_id === saboteurSessionId)` branch (~line 540): add the same `if (typeof picked === "number") answered += 1;` at the end.
- Leave the `qAnswered/qCorrect` room-level filter (`!isRoast && !isSaboteur`) untouched.

## Fix 5 — Make wildcard post-passes order-independent
- Immediately before the `if (isFirstBlood)` block (~line 630), assert mutual exclusion: `if (isFirstBlood && isHeist) throw new Error("First Blood and Heist cannot both be active in one round");`
- In the First Blood recompute, keep `u.score = Math.max(0, prevTotal + 0)` with the explanatory comment so the intent (round contribution stripped to zero) is explicit and no longer depends on `u.score` being untouched.

## Verification
1. `tsgo` typecheck.
2. Run `/dev` round-runner (Full 3-round + Lightning + Audience-handoff scenarios) — no phase regressions.
3. Manual double-fire smoke: end a question, immediately call `endQuestion` again → second call returns `{ ok: false, alreadyScored: true }`, scores unchanged.

## Files touched
- `src/lib/game.functions.ts` (only)
