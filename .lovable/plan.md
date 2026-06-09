## Problem

When an audience member fires a soundboard pad or reaction, the TV plays it at near-full volume (`p.volume ?? 0.9` in `src/routes/host.tsx:443`) and nothing on screen tells players who triggered it. Two things to fix together:

1. Audience-triggered sounds are too loud relative to music and announcer.
2. There's no attribution, and any attribution we add must NOT distract players reading the question.

## Fix

### 1. Attribute every broadcast with the sender

- `src/components/AudienceSoundboard.tsx` — accept `nickname` and `sessionId` props. Include them (plus `label` and `emoji` for pads) in both broadcast payloads:
  - `sfx_url`: `{ padId, url, volume, nickname, sessionId, label, emoji }`
  - `react`: `{ emoji, nickname, sessionId }`
- `src/routes/audience.tsx` — same addition in `sendReaction` (the `sfx` event payload becomes `{ sfx, nickname, sessionId }`).
- `src/routes/play.tsx:445` — pass `nickname={session.nickname}` and `sessionId={session.sessionId}` to `AudienceSoundboard`.

### 2. Cap audience sound volume on the host

In `src/routes/host.tsx:430-451`, hard-cap audience clips:

```ts
const AUDIENCE_MAX_VOLUME = 0.3;
// sfx_url:
playClipUrl(p.url!, Math.min(AUDIENCE_MAX_VOLUME, (p.volume ?? 0.9) * 0.35), p.padId);
```

For the synth `sfx` event path (`play(sfx)`), add an optional `volumeScale = 1` argument to `play()` in `src/lib/sound-engine.ts` and multiply the internal `g.gain.value` (in `tone` / `sweep` / `noise`) by it. Host calls `play(sfx, 0.4)` for audience-triggered events. Default behavior unchanged for every existing call site.

### 3. Show "who pushed it" out of the way

Add a small, non-intrusive **bottom-left feed** of audience events on the host screen — players read top-center (question) and 2×2 grid (answers), so bottom-left is the dead zone.

- New tiny event bus: `src/lib/audience-feed.ts` — module-level `EventTarget` with `emit(event)` and `subscribe(cb)`. `host.tsx`'s broadcast handler emits an entry `{ id, nickname, label, emoji, kind: "pad" | "react" | "sfx" }` per message.
- New component `src/components/host/AudienceFeed.tsx` mounted from `HostGameStage.tsx`. Subscribes to the bus, keeps the latest 3 entries, renders a stacked column at `bottom-4 left-4 z-30`. Each chip:
  - small (text-[11px]), text-white/55, `bg-white/[0.06] backdrop-blur-md` rounded pill
  - format: `{emoji} {nickname} · {label}` for pads, `{nickname} {emoji}` for reactions
  - slides in from the left, holds 2.5s, fades out

No interactivity, `pointer-events-none` so it can never block UI.

## Verification

Join from a second device as audience. Tap a few pads and reactions:
- TV sound is clearly under the music bed and announcer (not silent, just supporting).
- Bottom-left chips appear with sender name + sound, never near the question or answers.
- During final-question heartbeat the chips remain readable but don't compete visually.

## Out of scope

- No changes to the pad library / audience UI styling.
- No changes to player (non-audience) sound flow.
- No persisted log — chips are purely ephemeral.
- The separate "can't select answers on phone" complaint isn't addressed here; I'll need a screenshot or a repro (which question type, which device/browser) once we ship this so we can tackle it as its own fix.
