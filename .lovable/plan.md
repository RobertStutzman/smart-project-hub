# 1) Stop the category card from covering "Question N"
# 2) Expand the wildcard / special-question pool

## 1. Category card overlap

### What happens today
`QuestionStage` shows two things at the same time on `showBadge`:
- `ShutterTransition` — wipes in and holds the centered "Question N" title for ~900ms.
- `CategoryReveal` — pops a centered category card on top (z 35 > shutter z 30), so the number is obscured for the whole hold.

### Fix
Stage them sequentially so the audience reads **Question N → Category**, both center-stage, no overlap.

- Add an `appearDelayMs` prop to `src/components/host/CategoryReveal.tsx`. While `visible` is true, the card stays hidden internally until `appearDelayMs` elapses (clears the timer if `visible` flips off).
- `src/components/host/QuestionStage.tsx`: pass `appearDelayMs={1250}` so the category card only mounts after the shutter has held the question number long enough to read it, and pops in as the shutter opens.
- Keep the existing exit animation untouched (so it still clears before the question text fades in).

No timing changes to the shutter or question read flow — purely a deferred mount on the category card.

## 2. Current special questions (wildcards)

Wildcards fire on Q5 / Q10 / Q15 / Q20. Today the rotation is:

| Q  | Wildcard           | What it does |
|----|--------------------|--------------|
| 5  | **Lightning**      | 8-second timer, 2× points. |
| 10 | **Double or Nothing** | Lock in to double your score on a correct answer, lose it all on wrong. |
| 15 | **First Blood**    | Speed bonus — first correct lock gets a big multiplier. |
| 20 | **Underdog**       | The lowest-scoring live player earns 2× on a correct. |
| —  | Saboteur / Glitch / Roast | Defined but only fire as bonus slots (Q25+), so today they essentially never appear. |

So in a normal 20-question game you only ever see 4 wildcards.

## Proposal: add 4 new wildcards + activate the dormant trio

Bring the active pool from 4 → ~10 by promoting Saboteur / Glitch / Roast and adding four new mechanics. The rotation becomes a randomized 10-deep deck that reshuffles each game, so two sessions in a row never repeat the same order.

### New wildcards to add to `src/lib/game.functions.ts`
1. **Sudden Drop** — only two answers shown from the start (correct + one wrong). 1.5× points, 12s timer. Big "coin flip" energy.
2. **Mirror** — answers are revealed in reverse order with the letters scrambled (visual gag); same scoring. Pure chaos beat.
3. **Heist** — every correct answer *steals* 50 points from the current leader instead of awarding them. Massive table-flip moment.
4. **Blackout** — question text is read by VO only; the on-screen text is hidden until 5 seconds in. Rewards listening.

### Activate dormant wildcards
- **Saboteur** (already coded): one random player secretly sees a swapped "correct" answer; if they pick it they earn nothing and everyone else who picked it loses points.
- **Glitch** (already coded): UI "glitches" for 3s — answers briefly swap positions.
- **Roast** (already coded): no trivia question; players vote which top-4 player fits a silly prompt ("Who would survive a zombie apocalypse?").

### Rotation change
Replace the fixed `WILDCARD_ROTATION[slot]` index with a per-game shuffled deck of the 10 wildcards, drawing the first 4 for Q5/10/15/20. Stored on the room so it survives reloads. (Implementation note for technical review only.)

## Questions for you before I build #2
- Do you want all 10 in the pool, or pick a subset?
- Any of the four new ideas you want to drop or tweak?
- Keep the cadence at Q5/10/15/20, or sprinkle wildcards more often (e.g. every 3rd question)?

I'll build #1 immediately on approval. For #2 I'll wait for your picks so we don't ship mechanics you don't want.
