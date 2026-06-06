
# Give the "Did you know?" enough time to read

## Root cause

The reveal phase auto-advances after **3.5 seconds** (`HostGameStage.tsx` line 651). The explanation card has a 0.35s delay + 0.5s entrance animation, so you only get **~2.6 seconds of stable reading time** — exactly what you experienced. A typical 20-30 word fact needs ~6-8 seconds.

There are two timers:
- Mid-round reveal → next question: **3500ms** (too short)
- Final-question reveal → game over: **7000ms** (already decent)

## Fix

Single value change in `src/components/host/HostGameStage.tsx`:

- Bump the mid-round reveal timer from **3500ms → 8000ms**. That leaves ~7s of readable, stable time after the card animates in — comfortable for the whole room.
- Leave final-reveal at 7000ms (it's already fine and the game-over screen that follows isn't time-sensitive).

That's it. No new state, no UI changes, no player-side change needed (player screen mirrors the host's phase, so it advances at the same time).

## Out of scope

- Host-controlled "Next" button (you picked Option A earlier — keep auto-advance).
- Per-question read-time scaling based on explanation length (overkill for this).

## Files

- `src/components/host/HostGameStage.tsx` line 651 — change `3500` to `8000`.
