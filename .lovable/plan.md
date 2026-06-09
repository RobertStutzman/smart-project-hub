## Goal

Replace the thin 1200Hz square-wave "tick" with a warm woodblock-style "tock" + low sub-thump in the final seconds — HQ-Trivia feel, no piercing high end.

## Change

Single file: `src/lib/sound-engine.ts`, the `case "tick":` branch (lines 184–186).

Today:
```ts
case "tick":
  tone(1200, 0.04, "square", 0.1);
  break;
```

Replace with a layered woodblock hit — a short pitched body (sine/triangle around 320–420Hz with a sharp decay) plus a tiny click transient. This reads as a hollow wooden tock instead of a digital beep, at lower perceived loudness:

```ts
case "tick": {
  // Warm wooden tock — pitched body + transient click. Lower and rounder
  // than the old 1200Hz square so the loop under the timer is unobtrusive.
  sweep(520, 360, 0.06, "triangle", 0.12);   // body, quick downward pitch envelope
  sweep(1800, 900, 0.018, "sine", 0.05);     // soft attack transient
  break;
}
```

Add a parallel `"tickHeavy"` variant for the final 3 seconds — same wooden body plus a sub-bass thump so urgency lives in the low end, not the highs:

```ts
case "tickHeavy": {
  sweep(420, 280, 0.08, "triangle", 0.16);
  sweep(110, 55, 0.18, "sine", 0.32);        // sub-thump
  break;
}
```

Add `"tickHeavy"` to the `SoundName` union at the top of the file.

## Wire-up

In `src/components/host/HostGameStage.tsx`:
- Line 453 (regular last-5s tick loop): keep `play("tick")`.
- Line 1139 (final-question sub-3s 4-per-sec loop): swap to `play("tickHeavy")` so the heartbeat-style urgency uses the sub-thump variant.
- Line 111 in `QuestionStage.tsx` (soft tick as each answer lands during intro): keep `play("tick")` — the new softer tock works there too.

## Verification

Reload the host, advance into a question, listen through the final 5 seconds — should sound like a wooden clock instead of a kitchen-timer beep. Trigger the final question to confirm the heavier sub-bass thump under 3s.

## Out of scope

- No new audio files / CDN assets — staying with the synth engine to keep zero added load.
- No volume mixer changes, no music bed changes.
- No visual countdown changes.
