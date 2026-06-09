## Issue

The announcer voice plays through `HTMLAudioElement` (no AudioContext needed). Music and crowd ambience go through Web Audio AudioContexts (two separate contexts: one in `sound-engine.ts`, one in `ambience-engine.ts`). Browsers leave a freshly-created AudioContext in the `"suspended"` state until `ctx.resume()` is called **synchronously inside a user-gesture handler**.

Today's host startup path:
1. Effect runs → `await import("@/lib/ambience-engine")` → `ambience.startCrowd()`.
2. Inside `startLoop`, we `await ctx.resume()`. By this point we're past any gesture frame, so resume is a no-op silently and the layer never unblocks.
3. A fallback `pointerdown` retry is registered, but only **after** the await — if the user already clicked during room creation, that gesture is gone. The retry also uses `{ once: true }` and re-enters the same async path, so the resume still doesn't happen in a gesture frame.

Net result: announcer works, ambience/music don't, exactly what the user reports.

## Fix

Add a global, idempotent audio unlock that runs on the **very first** user gesture anywhere in the app and resumes both contexts synchronously inside that gesture.

### Changes

1. **`src/lib/sound-engine.ts`**
   - Export `resumeAudioContext()` that returns the current `AudioContext` (creating it if missing) and calls `ctx.resume()` synchronously — no awaits.

2. **`src/lib/ambience-engine.ts`**
   - Export `resumeAmbienceContext()` mirroring the above.
   - Export `retryBlockedAmbience()` that, if any layer was previously requested but blocked, retries `startCrowd()` / `startLobbyChatter()` etc. (track "wanted" state with a flag set whenever `startCrowd`/`startLobbyChatter`/`startDrumroll` is called while the context is suspended).

3. **`src/routes/__root.tsx`** (inside `RootComponent`)
   - Add a `useEffect` that registers a one-shot `pointerdown` + `keydown` + `touchstart` listener on `window` (capture phase). Inside the handler (synchronously):
     - Call `resumeAudioContext()` and `resumeAmbienceContext()`.
     - Then call `retryBlockedAmbience()`.
     - Remove all three listeners.
   - This runs once per app load, before any route-level effect, so the first click/keypress anywhere reliably unlocks both contexts.

4. **`src/routes/host.tsx`** (the existing room effect ~lines 357–376)
   - Keep the existing retry as a backup, but rely primarily on the root unlock. Move the `pointerdown`/`keydown` listener registration **before** the `await import(...)` so the gesture window isn't missed if the user clicks during room creation.

### Why this works

- Browsers permit `ctx.resume()` from any user gesture; once resumed, the context stays running for the page lifetime.
- The global unlock guarantees both contexts get resumed on the first interaction regardless of which route the user lands on (`/`, `/host`, `/play`, etc.).
- The `retryBlockedAmbience` call ensures any ambience layer that was requested while blocked actually starts playing after unlock — no need to re-trigger from the route.

### Out of scope

No change to mute persistence, sound assets, or announcer pathway.