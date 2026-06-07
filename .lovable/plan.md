# Bring back wrong-answer face overlay on host screen

## Problem
`src/components/host/ShatteredFaces.tsx` still exists (cracked-glass avatar overlay + sad-trombone) but is no longer imported anywhere. So no faces appear on the TV when players get a question wrong.

## Fix
Wire `ShatteredFaces` back into `QuestionStage` and trigger it on the transition into the `reveal` phase.

### Edit `src/components/host/QuestionStage.tsx`
1. Import `ShatteredFaces`.
2. Extend the local `Player` prop type with `is_audience?: boolean` (so we can exclude audience).
3. Inside the component, compute:
   ```ts
   const victims = phase === "reveal" && correctIndex != null
     ? players.filter(p => !p.is_audience && p.current_answer != null && p.current_answer !== correctIndex)
       .map(p => ({ id: p.id, nickname: p.nickname, avatar_url: p.avatar_url }))
     : [];
   const triggerKey = phase === "reveal" ? `${questionNumber}-reveal` : "";
   ```
4. Render `<ShatteredFaces victims={victims} triggerKey={triggerKey} />` near the bottom of the JSX (alongside other overlays).

### Edit `src/components/host/HostGameStage.tsx`
- `HostGameStage` already filters players when passing them to `QuestionStage` — confirm `is_audience` is on the player object (it is, from select list). No change needed there beyond making sure the field flows through. If TS complains, widen the `players` prop type passed in.

## Result
On every reveal, every non-audience player who picked the wrong answer (or chose anything other than correct) gets their avatar popped on screen for ~2 s with the cracked-glass effect + sad trombone, then auto-dismisses.

## Scope
Two-file presentation change. No DB, no server logic, no sound assets.
