## Goal

Make both score displays read like a real broadcast scoreboard, not a row of floating numbers. Replace the avatar-strip "Scoreboard" beat and the floating podium blocks with proportional, ranked, labeled bars.

## Files

- `src/components/host/RoundRecapReel.tsx` — replace the `scoreboard` beat
- `src/components/host/Leaderboard.tsx` — replace the podium + rest split with a single ranked bar chart

## 1. Recap "Scoreboard" beat (round-score chart)

Replace the centered row of 8 avatars + `+N` numbers with a horizontal-bar ranked chart of THIS round's scores.

Layout (top 8 players, sorted by `current_round_score` desc):

```text
RANK | AVATAR  NAME              [████████████████████  ] +120
  1  | (img)   ALEX     ⚡        [██████████████        ]  +90
  2  | (img)   SAM                [█████                 ]  +30
  ...
```

Per row:
- Fixed-width rank column (`1`–`8`), monospace, bold.
- 36px avatar with thin ring.
- Nickname (display font, truncate), small icons inline: ⚡ if `current_round_fastest`, 🔥 if `streak_count >= 3`.
- Bar track (`bg-white/5`, rounded) filling left-to-right to `score / maxScore` width, animated from 0 → final width with a 120ms stagger per row using framer-motion. Gold gradient for #1, white/amber for the rest. Subtle inner shadow for depth.
- Right-aligned `+score` in mono, emerald for >0, zinc for 0.

Header strip above the bars: small uppercase eyebrow "Round {N} · Round scores".
Height capped to fit the stage; if >8 players, show top 8 and a "+N more" pill at the bottom right. Speak line unchanged.

## 2. Leaderboard (cumulative chart)

Drop the 3 raised podium blocks + separate `<ol>` list. Replace with one unified ranked bar chart of ALL players by total `score`, same row pattern as above but tuned for "season standings":

- Rank column with gold/silver/bronze pill for ranks 1–3, plain mono number for 4+.
- Avatar 44px.
- Nickname + inline streak/fastest icons.
- Bar fills to `score / maxScore`. Tone: gold gradient (1st), silver (2nd), bronze (3rd), neutral white/10 for the rest.
- Right side shows total `score` (mono, large) and, if `current_round_score` is set and non-zero, a small delta chip underneath in emerald/rose (`+12` / `−4`).
- Smooth `layout` animation so rank changes glide between rounds.
- Top of board: small eyebrow "Standings · After round {N}" (pass `roundNumber` as a prop; default-safe if missing).

Container: max-w-4xl, dark glass card, generous row spacing, divider lines between rows (`border-white/5`).

## Style notes

- No emoji-heavy decoration. Keep the existing display/mono font pairing.
- Bars use solid tokens already in the file (amber/emerald/rose/zinc) — no new colors.
- Animations: enter-row stagger ~80–120ms, bar fill ~700ms `easeOut`, layout spring for rank changes. Nothing else moves.
- Readable at 10 ft: nickname `text-lg`, score `text-2xl`, bar height `h-3`.

## Out of scope

- No data shape changes; only consumes existing `Player` fields.
- No backend / RLS / DB changes.
- Other recap beats (MVP, fastest, streak, spoon, climb, drop) untouched.
- No countdown reintroduction.

## Verification

- Visual check at `/host` after a round ends: bars animate in ranked order, totals legible, podium replaced with a proper bar chart, layout doesn't overflow at 934px or 1920px wide.