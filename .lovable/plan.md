## What's making him talk over himself

On the QR / lobby screen, three voice sources fire near each other and **only two of them share a queue**:

1. **Welcome intro clip** (`src/routes/host.tsx` lines 319-323) — plays a random "welcome" sound via `new Audio(pick.url).play()`. This **bypasses the elf-voice queue entirely**.
2. **Persona opener** at +1.8s — goes through `speakPersona` → `speakAsElf` queue.
3. **Lobby quips every 10s** — also through the queue.

Because the welcome clip is outside the queue, the opener (and any quip that lands while the welcome is still playing) plays *on top of* it. The queue only sequences items inside itself; it has no awareness of the raw `Audio` element from the welcome.

There's likely a second contributing factor: on the iPad, the welcome and opener can both be ~3–5s long, so a 10s interval tick can land while one of them is still going. Today the tick uses `interrupt: false` so it queues — but again, only behind queued items, not behind the welcome.

## Fix

Two small changes — voice only, no visual changes.

### 1. Route the welcome clip through the voice queue (`src/routes/host.tsx`)

Replace the raw `new Audio(pick.url).play()` with `playVoiceUrl(pick.url, { volume, interrupt: true })` from `@/lib/elf-voice`. That puts the welcome on the same single-line queue everything else uses, so the opener will wait for it to finish.

### 2. Give the opener and the ticks a small extra safety net (`src/routes/host.tsx`)

- Bump the opener delay from 1800ms → 2400ms so the welcome has more breathing room even on slow networks.
- Keep `speakPersona(..., { interrupt: false })` (the default). Now that the welcome is in the queue, "no interrupt" means everything serializes cleanly: welcome → opener → quip → quip…
- Optional belt-and-suspenders: in the 10s tick, skip the line if there's already audio playing. We can expose a small `isElfSpeaking()` helper from `elf-voice.ts` (returns `currentAudio !== null`) and check it before pushing the next quip. This prevents the queue from growing into a backlog when the user is on the lobby a long time.

### 3. Add a one-line dev log so the next regression is easy to spot

In `speakAsElf` (and `playVoiceUrl`), `console.info("[elf] queue +", text.slice(0, 40))` when a task starts and `[elf] queue -` when it ends. If you ever hear overlap again, the console will show two starts without a stop in between — instant diagnosis.

## Files touched

- `src/routes/host.tsx` — swap raw Audio for `playVoiceUrl`, bump opener delay, add `isElfSpeaking()` guard in the tick
- `src/lib/elf-voice.ts` — export `isElfSpeaking()`, add two-line dev logging

## What you'll experience

- Tap "Host on this screen" → QR appears → welcome plays → ~600ms beat → opener line → 10s later a quip (only if the previous one finished). No more crosstalk.
- The visual flow doesn't change.