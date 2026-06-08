# Fix: Announcer talks over itself when ending a game and starting a new room

## Root cause

The announcer plays through a single-line queue in `src/lib/elf-voice.ts`:

```ts
queue = queue.then(safe, safe);
```

`cancelElfSpeech()` pauses the currently playing `<audio>` and reassigns
`queue = Promise.resolve()`. That only affects **future** `speakAsElf` /
`playVoiceUrl` callers. Tasks that were already chained onto the prior queue
keep their own reference to the old promise and continue executing one after
another — each spinning up a fresh `new Audio(...)`.

So when you hit "End game and start a fresh room":

1. The Credits stage had already queued a sequence of `speakPersona` lines.
2. `cancelElfSpeech` is called on unmount — kills the currently playing line.
3. The next chained task in the old queue still fires → starts another Audio.
4. Meanwhile the new room's welcome clip + lobby opener + persona banter
   start queueing on the freshly reset `queue`.
5. Result: leftover credits/round lines overlap the new lobby announcer.

## Fix

### 1. Make `cancelElfSpeech` actually cancel queued work — `src/lib/elf-voice.ts`

Introduce a `generation` counter. Each task captures the generation at the
moment it was enqueued; `cancelElfSpeech` increments it. Inside every queued
task, check the generation right before playing — if it changed, resolve
immediately without creating a new `Audio`.

Apply this to all three audio paths in the file:

- `speakAsElf` task (pre-baked URL branch, `fetchAudio` URL branch, base64 branch)
- `playVoiceUrl` task

Sketch:

```ts
let generation = 0;

export function cancelElfSpeech() {
  generation++;
  if (currentAudio) { try { currentAudio.pause(); } catch {} currentAudio = null; }
  queue = Promise.resolve();
}

// inside each enqueued task:
const myGen = generation;
const task = async () => {
  if (opts.interrupt) cancelElfSpeech();
  if (generation !== myGen && !opts.interrupt) return; // cancelled before our turn
  // ... await audio, but bail out before play() if generation changed
};
```

Subtlety: `speakAsElf`/`playVoiceUrl` callers that pass `interrupt: true`
EXPECT to bump the generation themselves and still play — capture `myGen`
AFTER the optional `cancelElfSpeech()` call, not before.

Also guard the `await fetchAudio(...)` resume point: if the generation
changed while we were waiting on the network/TTS response, return without
playing.

### 2. Silence the announcer before spinning up a new room — `src/routes/host.tsx`

In `endAndStartNewRoom`, call `cancelElfSpeech()` at the top so any
in-flight credits/recap lines are dropped before the new room's welcome +
opener queue up. This is now meaningful because of fix #1.

```ts
async function endAndStartNewRoom() {
  if (!room) return;
  if (!window.confirm(...)) return;
  const { cancelElfSpeech } = await import("@/lib/elf-voice");
  cancelElfSpeech();
  // ... existing logic
}
```

Also do the same in the "parent:new-room" message handler effect (dev
playground "new room" button takes the same path).

## Out of scope

- No changes to host-persona line content or moment selection.
- No changes to the credits sequence itself — only how cancellation propagates.
- No changes to ambience / music / SFX pipelines.

## Verification

1. Start a game, advance to credits, click "End game and start new room".
2. Confirm only the new room's welcome clip + single lobby opener play —
   no leftover credits or recap lines overlap.
3. Repeat 2–3 times back-to-back to confirm queues drain cleanly.
4. Normal lobby banter (rotating quips every 10s) still works in the new room.

## Files touched

- `src/lib/elf-voice.ts` — generation counter wired into both `speakAsElf` and `playVoiceUrl`.
- `src/routes/host.tsx` — call `cancelElfSpeech()` in `endAndStartNewRoom` and the parent "new-room" reset path.
