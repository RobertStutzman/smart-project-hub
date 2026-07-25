## What's actually happening

"This page didn't load" is our generic error boundary. It fires anytime a React render throws OR a code-split chunk fails to load — but it currently hides the underlying `error.message`, so we can't tell which failure Start is hitting for you.

Ruled out from what I already checked:
- The `content_rating` column exists on both `questions` and `rooms` (verified in the DB), so the new server-side rating filter isn't 500'ing on a missing column.
- `restartGame` / `setPhase` errors in `handleStartClick` are already caught locally — they shouldn't reach the boundary.
- Dev server has only deprecation warnings, no build errors.

Left as suspects (any one of these can trigger the exact symptom on Start):
- A dynamic `import(...)` in the post-lobby chain (Elf voice / ambience / sound-engine / HostGameStage children) failing with a stale hashed chunk. We auto-reload once via `vite:preloadError`, but if the same import keeps failing we're stuck.
- A serverFn thrown during the first `nextQuestion` after phase → intro (rating filter returns an empty pool for a category combo, or a downstream query throws), bubbling into HostGameStage's render.
- Something HostGameStage subscribes to that throws when `room.content_rating` is present but a related column shape isn't what the client expects.

Without the real error text I'd be guessing. The plan is to make the boundary tell us, wrap Start so failures don't nuke the page, and add belt-and-suspenders for the stale-chunk case.

## Plan

### 1. Make the error boundary show the truth
`src/routes/__root.tsx` `ErrorComponent`:
- Render `error.message` (and `error.name`) under the generic copy, in a small `<pre>` block. Not pretty, but you can screenshot it and we're done guessing.
- Keep the stale-chunk auto-reload, but log `error.message` to `console.error` with a `[start-fail]` tag before reloading so it survives the reload in the network/console log capture.

### 2. Don't let a Start failure trash the whole page
`src/routes/host.tsx` `actuallyStart`:
- Wrap the whole body (including the dynamic `import("@/lib/elf-voice")` and `stopMusic()` calls, not just the serverFn block) in try/catch.
- On failure: `toast.error(<real message>)`, keep the host on the lobby, set `error` state, do NOT flip phase. Right now a mid-chain throw before `setPhaseFn` can leave the UI in a half-torn-down state that renders wrong on the next tick.
- Add a `console.info("[start]", step)` breadcrumb before each async step so the next failure is easy to attribute.

### 3. Harden the stale-chunk recovery
`src/routes/__root.tsx`:
- Also listen for global `unhandledrejection` where `reason.message` matches the stale-chunk regex — Vite's `vite:preloadError` doesn't cover every dynamic `import()` failure path we use in host.tsx (bare `await import(...)` inside `try/catch` swallows the event, but the rejection is still observable at the window level when it escapes).
- After the one-shot reload, if we come back and immediately hit another stale-chunk error, show a "Hard refresh required — tap here to clear cache and reload" button that calls `caches.keys().then(...delete...)` + reload, so a bad service-worker cache can't keep the user stuck.

### 4. Verify (once #1 lands)
- Pick MA, hit Start on `/host`, screenshot the error line — that tells us exactly which module/serverFn is throwing.
- If it's a serverFn: fix the underlying query (most likely a rating+category combo producing an empty pool that the caller doesn't guard).
- If it's a chunk import: the hard-refresh button clears it; longer-term add a `?v=<buildId>` query param to the outermost dynamic imports so a stale index chunk fetches the current hash instead of a dead one.

## Out of scope
- Any changes to the rating logic itself, adult persona, or announcer bakes.
- Reworking HostGameStage's stage machine.
- Removing the auto-reload — it does the right thing for the common case; we're just adding a visible escape hatch and better diagnostics.

Once you approve, I'll implement #1–#3, you tap Start once, screenshot the exposed error, and I'll fix the underlying cause as a follow-up.