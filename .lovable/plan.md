## Goal

Make `/host` feel like a Jackbox host screen: short URL, one-tap fullscreen, screen never dims, keyboard/remote-friendly.

## 1. Short URL — `/h` and `/h/$code`

New routes:
- `src/routes/h.tsx` → redirects to `/host`
- `src/routes/h.$code.tsx` → redirects to `/host/$code`

So a host can type `[domain]/h` on a Firestick remote and skip the longer `/host`. (True short domain like `beatthedrop.tv` still requires buying one separately — out of scope for code.)

## 2. Auto-fullscreen + wake lock for `/host`

New hook `src/hooks/useHostStageMode.ts`:
- **Fullscreen**: exposes `enterFullscreen()` using the `Fullscreen API` (`document.documentElement.requestFullscreen()`), with the iOS Safari fallback (just no-op — Apple TV / iOS not realistic hosts anyway).
- **Wake Lock**: on mount, request `navigator.wakeLock.request("screen")`. Re-acquire on `visibilitychange` (browser drops the lock when tab is backgrounded). Release on unmount.
- Works on Chrome/Edge/Silk (Firestick) — gracefully no-ops on Safari.

Wire the hook into the `/host` route shell so it runs for both lobby and in-game.

Add a small **"⛶ Fullscreen"** pill button in the host top-right header (next to "End · new room"). Auto-hides once already in fullscreen. Browser security requires fullscreen be triggered by a user gesture, so we surface a button instead of trying to auto-fire.

## 3. Keyboard / remote control

New hook `src/hooks/useHostHotkeys.ts` that wires global key handlers:
- **Space** or **Enter** → clicks the currently-visible "primary" button on screen (the one that advances the phase: Start, Reveal, Next, Roll credits, etc.).
- **F** → toggles fullscreen.
- **Escape** → already handled by browser to exit fullscreen.

Implementation: each phase's primary button gets `data-host-primary="true"`. The hotkey hook does `document.querySelector('[data-host-primary]')?.click()`. Minimal coupling — no need to refactor state machines.

Tag primary buttons in `HostGameStage.tsx` (~8 spots: start lobby, reveal, next question, sudden death, roll credits, etc.).

Firestick remote's center "OK" button maps to Enter on most TV browsers, so this gives remote users one-button gameplay.

## 4. Tell the host how to use it

On the host **lobby** screen, add a tiny one-line tip near the footer:
> "Press **F** for fullscreen · **Space** to advance · works great on Firestick"

## Out of scope

- Buying/connecting a short domain (you do that in Project Settings → Domains).
- Native Fire TV app wrap — separate effort once you validate engagement.
- Casting / AirPlay handling — those are platform-native and don't need code.
- Mapping every Firestick remote D-pad direction — Enter/Space covers 95% of host actions.

## Technical notes

- Wake Lock + Fullscreen APIs both require HTTPS (preview + published URLs are both HTTPS — works).
- Wake Lock auto-releases when the tab loses visibility; the hook re-acquires on `visibilitychange` so a host backgrounding their browser briefly doesn't leave the TV dimming.
- No new dependencies.