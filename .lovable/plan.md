## Goal

Turn the round recap from a 4.2s blip into a ~12s mini "SportsCenter" with multiple beats, Vox persona voice calling players out by name (winners AND losers), and visible low-score shame — not just the fastest finger.

## Current state

`src/components/host/RoundRecapReel.tsx` runs 3 beats × 1400ms (4.2s total):
1. "Round N" splash
2. Fastest finger
3. Round MVP

`speakPersona()` only fires generic "Fastest finger: X" and "Round MVP: Y" on beats 1–2. There is no last-place callout, no biggest-drop call, no streak/goose-egg shame. `HostGameStage.tsx` separately fires `speakAboutPlayer({moment: "round_recap"})` on leaderboard phase — that runs in parallel to the reel and isn't synced.

## New reel structure (6 beats, ~12.5s total)

```
beat 0  Round N splash                       1.4s
beat 1  Fastest Finger     (Vox + name)      2.1s
beat 2  Hot Streak / Combo King (if any)     2.0s   ← skipped if no streak ≥2
beat 3  Round MVP          (Vox + roast)     2.4s
beat 4  Wooden Spoon       (Vox dunks)       2.2s   ← lowest scorer this round
beat 5  Goose Eggs / Zero Club (if any)      2.0s   ← players who scored 0
beat 6  Leaderboard tease  ("To the board!") 1.4s
```

Beats 2 and 5 are conditional — skipped (their slot collapses, total shortens) when there's no streak or no zero-scorers. Beat 4 always runs.

### Picks per beat

- **Fastest**: existing logic (`current_round_fastest`).
- **Hot Streak**: highest `streak_count` if ≥ 2.
- **MVP**: highest `current_round_score`.
- **Wooden Spoon**: lowest `current_round_score` among non-audience players who actually answered (skip if everyone tied or only one player).
- **Goose Eggs**: all non-audience players with `current_round_score === 0` AND `current_answer !== null` (didn't answer counts too — pick whichever read feels punchier; default to "answered but scored 0"). If 1 player, name them; if 2-3 list nicknames; if 4+ show count + first two faces "…and N more".

## Vox voice lines (add to `src/lib/host-persona.ts`)

Add two new moments to the `LINES` map and `Moment` union:
- `wooden_spoon` — playful dunks: "Wooden spoon goes to {name}. Try harder.", "{name} found a way. The wrong way.", "{name}, the floor called. It misses you.", "Last place: {name}. Somebody had to.", "{name}, that round was a hate crime against trivia.", ~20 lines.
- `goose_egg` — for shutout players: "Big zero for {name}. Reflect on that.", "{name} brought a knife to a knowledge fight.", ~15 lines.

Also expand `round_recap` and add ~10 new MVP roast lines ("MVP: {name}. Insufferable.", "{name} cooked. Everyone else got cooked.").

Extend `speakAboutPlayer({moment, nickname})` already accepts arbitrary moments via the same shape — no signature change.

## Reel implementation

`src/components/host/RoundRecapReel.tsx`:
- Replace fixed `TOTAL_BEATS = 3` / `BEAT_MS = 1400` with a `beats: Beat[]` array built from props with per-beat duration. Filter out conditional beats whose data is empty so we don't show blank slides.
- Each beat object: `{ key, durationMs, render: () => ReactNode, speak?: () => void }`.
- Single scheduling effect walks the array; on each tick calls `speak?.()` for that beat (replaces the existing voice `useEffect`). All voice goes through `speakPersona`/`speakAboutPlayer` with `interrupt: true` so beats don't overlap.
- Add new layouts:
  - **Hot Streak**: avatar + flame emoji wall + "{n}× STREAK".
  - **Wooden Spoon**: avatar rotated slightly, desaturated, red gradient bg, big "🥄 LAST PLACE", Vox roast line printed under nickname.
  - **Goose Eggs**: row of 1-3 avatars side-by-side with big "0" badges; if 4+, show first two + "+N more" chip.
  - **Leaderboard tease**: "To the board ↓" with a downward arrow animation.
- Update bottom progress pips to reflect actual beat count.
- Keep the sweeping light bar / film grain background; retime its duration to the new total.

## HostGameStage cleanup

`src/components/host/HostGameStage.tsx`:
- Remove the separate `roundRecapFiredForRoundRef` MVP speech at lines ~622–639 (the reel now owns MVP voice). Keep `leader_changed` and `comeback` — those fire on the leaderboard *after* the reel.
- The recap-bar `4500ms` autoplay underneath the leaderboard tease (line ~1229) stays — that's the post-reel "next round incoming" bar, independent of the reel itself. (Recap reel completion via `onDone` is what unlocks `setRecapDoneForRound`, so the longer reel will naturally delay leaderboard auto-advance.)

## Out of scope

- No changes to scoring, leaderboard layout, persona TTS engine, or elf-voice synthesis path.
- No new TTS pre-bake — uses the existing `speakPersona` runtime path.
- No new database fields (everything derives from existing `current_round_score`, `current_answer`, `streak_count`).

## Capacity / timing summary

- Total reel: ~12.5s max, ~8.5s min (when both conditional beats skipped).
- Voice: 1 line per beat, `interrupt: true` so a slow line never bleeds into the next slide.
- No additional API calls; all voice goes through the existing elf/persona pipeline.