# Fix: Player display shows wrong round number

## Problem
In `src/routes/play.tsx` line 641, the per-question header on the player view shows:
```
Q · Round {room.round_number}
```
But `room.round_number` is the **global question index (1–20)**, not the round. So it reads "Round 1, Round 2, … Round 20".

## Fix
Replace with a derived display that shows both the question within the round and the actual round (1–4):
```tsx
`Q${((room.round_number - 1) % 5) + 1} · Round ${Math.min(4, Math.ceil(room.round_number / 5))}`
```
So Q3 of round 2 displays as `Q3 · Round 2`.

Single-line edit in `src/routes/play.tsx`. No other files affected.
