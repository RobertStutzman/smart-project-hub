# Dev Playground: watch the game play itself

The current `/dev` page just spawns bot iframes — you can't see the actual host gameplay (questions, reveals, leaderboard, animations). Let's rebuild it into a single screen where the **real host UI** runs on the left and a swarm of bots play along on the right, so you can watch the full game loop end-to-end from your laptop.

## New layout for `/dev`

```text
┌───────────────────────────────────────────────────────────────┐
│  Dev Playground   [Bots: 6 ▾] [Mode: smart ▾] [▶ Start game] │
├──────────────────────────────────────┬────────────────────────┤
│                                      │  Bots (6)              │
│                                      │ ┌────────────────────┐ │
│         HOST VIEW (iframe /host)     │ │ Bot_01  ✅ A  120 │ │
│         - QR / lobby                 │ │ Bot_02  ⏳     80 │ │
│         - Question stage             │ │ Bot_03  ✅ C  140 │ │
│         - Reveal + leaderboard       │ │ ...                │ │
│                                      │ └────────────────────┘ │
│                                      │  [+ Add bot] [⏹ Stop]  │
└──────────────────────────────────────┴────────────────────────┘
```

One screen, no phone, no second tab. You drive the game from the host iframe (Start, Next question, etc.) and watch bots react live on the right.

## How it works

1. **Host pane (left, ~70% width):** an `<iframe src="/host">` running the real host route. Full lobby → questions → reveals → leaderboard → shattered faces, exactly what a real host sees.
2. **Auto-wire the room code:** when the host iframe loads, the parent reads the generated room code (via `postMessage` from `/host`, or by polling `localStorage` inside the iframe) so you don't have to copy-paste it.
3. **Bot rail (right, ~30% width):** instead of one iframe per bot (heavy, 12 React apps), run all bots as plain async functions in the parent page. Each bot:
   - calls `joinRoom({ roomCode, nickname })` once
   - subscribes to the `rooms` row via supabase realtime
   - on `phase === 'question'`, waits `lockDelay` ms then calls `lockAnswer` with smart/random/wrong pick
   - renders as a compact row (name, current pick, ✅/⏳, score)
4. **Controls bar (top):** bot count (1–20), answer mode, lock delay, "Add bot", "Stop all". Changing count adds/removes bots live without resetting the room.

## Files to change

- **Rewrite `src/routes/dev.tsx`** into the split layout above. Host iframe on the left, bot manager on the right.
- **Delete `src/routes/dev.bot.tsx`** — no longer needed; bots run in-process in the parent. Removes the per-bot React/iframe overhead and lets us show 12+ bots smoothly.
- **Tiny addition to `src/routes/host.tsx`:** on mount, `window.parent?.postMessage({ type: 'host:room', code }, '*')` once the room code is known, so the dev page can pick it up automatically. No visual change to `/host`.

No backend, schema, or game-logic changes — purely a dev-tools refactor of the playground.

## Open question

Want the host iframe to **auto-advance** questions on a timer (e.g. every 8s) so the game truly plays itself while you just watch? Or keep manual "Next question" clicks so you can pause and inspect each stage? I'd default to **manual** — you see more — with an optional "Auto-advance" toggle in the controls bar.
