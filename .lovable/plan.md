## Issue #4 — Round recap too short

**What's happening:** With few players (or solo testing), most recap beats are gated on conditions:
- Fastest finger needs someone with a score
- Hot streak needs streak ≥ 2
- MVP needs score > 0
- Wooden Spoon needs ≥ 2 players with score spread
- Goose Egg needs ≥ 2 players with zeros

Falling through all of these leaves only the splash (1400ms) + "To the board" (1400ms) = ~2.8s recap. That's what felt like "1 second."

## Fix — `src/components/host/RoundRecapReel.tsx`

1. **Add a guaranteed "Round Scoreboard" beat** between splash and the conditional beats. It always renders: shows every real player's avatar + round score in a grid, sorted high→low. Duration `2600ms`. Speaks: "Here's how round N shook out."

2. **Bump splash duration** from 1400ms → 1800ms so the "Round N" title lands with weight.

3. **Bump the "To the board" outro** from 1400ms → 1800ms.

4. Conditional beats (fastest / streak / MVP / spoon / zeros) stay as-is — they layer on top when they exist.

## Result

Minimum recap runtime (no conditional beats fire): splash 1.8s + scoreboard 2.6s + outro 1.8s = **6.2s**, with a meaningful per-player scoreboard always visible. Full recap with all beats still flows naturally.

No other files change.