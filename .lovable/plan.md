# Full-screen reveal: correct answer + Did You Know

## Current
On reveal, the 2×2 answer grid stays, and "Did you know?" is jammed into a 16vh banner under it with `line-clamp-2`. Hard to read on the TV.

## Proposed change (in `src/components/host/QuestionStage.tsx`)

Add a **2-beat reveal**:
1. **Beat 1 (~2 s)** — keep existing reveal animation on the answer grid: correct tile glows, wrong tiles dim, shattered-face overlay pops. This preserves the dramatic "who got it right" moment + ShatteredFaces.
2. **Beat 2 (rest of reveal)** — swap the grid + small banner for a **full-screen reveal card** taking the whole stage:
   - Tiny "Correct answer" eyebrow
   - Huge correct answer (e.g. `font-display text-7xl`, "A. {answer}")
   - Divider
   - "💡 Did you know?" label
   - Full explanation in large readable type (`text-2xl`/`3xl`, no `line-clamp`, wraps freely)
   - No question tiles, no media in this view — clean and TTS-friendly

Use a `useEffect` + `setTimeout(2000)` keyed on `questionNumber + phase` to flip an internal `revealStage` state from `"tiles"` → `"fullscreen"`. Resets on next question.

Existing "Did you know?" small banner: remove (replaced by full-screen card).

ShatteredFaces overlay still fires on entering reveal (already wired) — it sits z-50 over either layout, so it just works.

## Out of scope (next turn)
ElevenLabs TTS reading the explanation — you mentioned you'll add that. I'll leave a clean hook: an `onFullscreenEnter` callback or just have the parent observe `phase === "reveal"` + 2s delay. Easiest follow-up is to fire TTS from `HostGameStage` when phase enters reveal.

## Files
- `src/components/host/QuestionStage.tsx` — only file changed.
