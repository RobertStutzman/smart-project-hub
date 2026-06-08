# Full efficiency audit (post 1k-iteration cleanup)

Four independent passes. Each one: investigate → list findings → apply only **safe, high-value fixes** → report what's left as optional. No behavior changes, no UI changes — just making what's already there leaner and more reliable.

## Pass 1 — Runtime performance (host + play)

Goal: nothing blocks the main thread or re-renders excessively during a live game.

Investigate:
- Profile `/host` during a question transition and `/play` during answer submission using the browser CPU profiler
- Audit `useEffect` deps in the heaviest stages (`CreditsStage`, `FinalStages`, `RoundRecapReel`, `WagerStage`, `QuestionStage`, `Scoreboard`) for re-render storms
- Find unmemoized inline objects/arrays passed to children, missing `useCallback`/`useMemo` on hot paths
- Check for `setInterval`/`setTimeout` running every <100ms unnecessarily
- Check framer-motion `AnimatePresence` lists for missing `key`s causing full unmount/remount

Fix (safe only):
- Add `React.memo` / `useMemo` / `useCallback` where a hot child re-renders on every parent tick
- Replace any `setInterval(…, 16)` ticker with `requestAnimationFrame` when used purely for animation
- Lift static config objects out of component bodies

## Pass 2 — Memory & subscription leaks

Goal: a 2-hour game night without refresh doesn't accumulate listeners, audio elements, or realtime channels.

Investigate:
- Every `useEffect` returning a subscription/timer/listener — verify cleanup
- Every `supabase.channel(...)` — verify matching `removeChannel` on unmount AND on dependency change
- Every `new Audio()` / `audio.play()` site — verify the element is reused or paused+nulled on unmount
- `addEventListener` calls (window/document) — verify `removeEventListener`
- Toast/sonner usage — confirm no infinite re-toast loops

Fix:
- Add missing cleanups
- Convert any realtime channel that's recreated per render into a stable channel keyed by `room_code`
- Consolidate audio elements created in multiple places into the existing `sound-engine.ts` if any orphan creators exist

## Pass 3 — Bundle, assets, dead code

Goal: faster cold load on phones and TVs, less wasted bandwidth.

Investigate:
- Run `bun pm ls` + grep usage to find npm packages installed but never imported
- Find `.tsx`/`.ts` files in `src/` with zero importers (orphaned after iteration)
- Audit `src/assets/` (and `.asset.json` pointers) for images >300KB and any unused assets
- Check for synchronous imports of heavy libs (e.g. `framer-motion` features, `@radix-ui/*`, charting) on the lobby/landing route — candidates for lazy import
- Verify route-level code splitting is working (TanStack auto-splits but exported components break it — see code-splitting rules)

Fix:
- Remove unused dependencies
- Delete orphan files (only after confirming zero references)
- Convert exported route components to non-exported ones if any break splitting
- Lazy-import the host-only stages from the play route and vice versa if they're cross-imported

## Pass 4 — Database & realtime

Goal: the backend keeps up at 8 concurrent players × 10 rounds without query stalls.

Investigate:
- Run `supabase--linter` for missing indexes / overly broad RLS
- Audit the hot query paths: room join, answer submit, round advance, score read — look for N+1 (multiple round-trips per stage transition)
- Count realtime channels per game session — one channel per room is ideal; per-player is fine; per-question is a leak
- Verify indexes on the columns we filter by most: `rooms.code`, `players.room_id`, `answers.round_id`, etc.

Fix:
- Add missing indexes (single migration)
- Collapse any obvious N+1 into a single `.select()` with joins
- Anything risky (RLS changes, policy rewrites) reported only, not auto-applied

## Reporting format

After each pass I'll give you:
- **What I found** (numbered list, severity tagged: 🔴 will-bite-you / 🟡 worth-fixing / 🟢 polish)
- **What I fixed** (bullet list of files changed)
- **What I left** (optional fixes with the tradeoff explained)

## Out of scope (explicit)

- No visual/UX changes
- No new features
- No TTS prompt or game-logic edits
- No schema rewrites — only additive indexes
- No bundle-splitter config overhaul (defaults are good)

## Estimated touch surface

~15–30 files edited, 1 small DB migration (indexes only), 0 new dependencies, likely several dependencies removed.
