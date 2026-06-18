## Goal

When the round reveals and the player picked the wrong answer, flash a big ✕ across the whole player screen — the same chunky icon currently shown on a dropped/eliminated answer tile — instead of (or on top of) the small "✗ Wrong" badge.

## What changes

**File:** `src/routes/play.tsx`

1. Add a new local state + effect that detects the transition into `phase === "reveal"` when `me.last_answer_correct === false`. On that transition, set `showWrongFlash = true` for ~1.4s, then auto-clear.
2. Render a full-viewport overlay (fixed inset-0, z-50, pointer-events-none) on top of the player UI when `showWrongFlash` is true:
   - Dim/red-tinted backdrop (`bg-rose-950/70 backdrop-blur-sm`)
   - Giant ✕ glyph centered, matching the dropped-tile style (font-black, text-destructive, drop-shadow), sized to fill the screen (`text-[55vw] sm:text-[40vw]`)
   - Entrance via `animate-scale-in`, then a quick scale/fade exit
   - Subtle "WRONG" label under it in uppercase tracking, same rose palette
3. Leave the existing small reveal banner in place behind the flash so the score delta / "Shake it off." copy is still visible once the flash fades. (Optional: shrink the small ✗ Wrong badge or drop it entirely — see Open question.)
4. Trigger haptics `Haptics.wrong()` once when the flash mounts (already fires on pick, but firing at reveal too reinforces the moment).

## Technical details

- Use a `useRef` to track the previously seen phase so the flash only fires on the question→reveal edge, not on every render while in reveal.
- Reset the flash whenever `room.current_question_text` changes, so a fast next-question doesn't carry it over.
- No backend / schema / sound-engine changes. The big ✕ glyph is plain text (same `✕` character used in `AnswerGrid.tsx`), no new asset.
- Correct answers are unchanged — still get the existing emerald banner, no full-screen flash.

## Open question

Do you want the small "✗ Wrong" banner below the answer grid to stay (so the score delta is readable after the flash), or get fully replaced by the big flash?
