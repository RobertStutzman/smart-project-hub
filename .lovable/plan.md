## Short answer

**Yes, a lot of the lag is the preview environment, not your app.**

The preview you tested on runs in Vite **dev mode**: 147 separate un-minified script files, no code-splitting, hot-reload websocket, no asset compression. The same code on your **published URL** (`droptrivia.app`) and inside a packaged app load is dramatically faster — usually 3–5× snappier. So packaging will help a lot on its own.

But there are also **two real performance bugs in the app** I want to fix so it stays smooth even on cheap phones.

## What I found

I ran a perf profile on `/host`. Two things stand out:

1. **`HostGameStage` re-renders 10 times per second.** There's a `setInterval(() => setNow(Date.now()), 100)` on line 203 that forces the entire 1,343-line host component (and every child — QuestionStage, AnswerGrid, Leaderboard, particles, etc.) to re-render every 100ms. This is the single biggest source of phone-side jank.

2. **`ThemeParticles` draws 80 glowing embers with `shadowBlur: 8` every frame.** `shadowBlur` on a canvas is one of the most expensive 2D operations — it's roughly 5–10× the cost of the same draw without a glow. On low-end phones this alone can eat 30–40% of a frame.

Smaller stuff (147 dev scripts, framer-motion bundle, etc.) goes away in production.

## Fix

### `src/components/host/HostGameStage.tsx`
- Change the 100ms tick to **250ms** (still plenty fine for countdown timing — 4 ticks/sec vs 10) and rename `now` usage so we only re-render the component that actually needs the clock. If the tick is only used by the timer ring, isolate it into a tiny `<TimerTick>` subcomponent so the big stage doesn't re-render.

### `src/components/ThemeParticles.tsx`
- Drop ember count from **80 → 40**.
- Remove `shadowBlur` and replace the glow with a pre-rendered radial-gradient sprite drawn once into an offscreen canvas, then `drawImage`'d per ember. Same look, ~5× cheaper.
- Skip rendering entirely when the host is in the active "question" phase (the screen already has tile animations, dots, and a timer — particles aren't visible behind it anyway). Resume on lobby / reveal / leaderboard.
- Already pauses on tab-hidden and respects `prefers-reduced-motion` — keep that.

### No changes to
- The realtime channel, heartbeat (5s), or game logic.
- The visual theme, ember color, or motion feel on lobby/leaderboard.

## What you'll experience

- Host preview: noticeably smoother scrolling, transitions, and tile drops.
- Phone (player side): unchanged by these fixes — the player screens are already light. Their lag is almost entirely the dev preview, and will be gone in the packaged app.
- Published site / app build: should feel close to a native app on a modern phone.

## Will packaging fix the rest?

Yes for these reasons:
- Production build minifies + bundles → ~10 script requests instead of 147.
- Assets gzip/brotli compressed.
- No dev-server websocket, no source maps eating CPU.
- PWA / Capacitor wrapper caches everything locally after first load.

After these two code fixes + running on the published URL or in the wrapped app, this should feel smooth. If it still lags on a specific screen (e.g. final round, leaderboard), tell me which one and I'll profile that specific stage next.

---

Ready to implement? After #1 lands we move to #2 (QR + selfie theme).