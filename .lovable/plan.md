## Problem

On `/` and `/join` you should hear venue chatter (people murmuring before doors open). Today:

1. The Home page's "Host on this screen" button is the user's first click on the page, so the gesture-gated `startLobbyChatter()` fires at the same moment the button's `onClick` pre-arms `startCrowd()` + `startDrumroll()`. Chatter is drowned by the louder crowd/drum that follow you into `/host`.
2. On `/join`, chatter does start on first tap, but its target volume (0.14) sits under everything else and is easy to miss.
3. Net effect for the user: "I only hear crowd + drums after clicking Host."

## Fix

Treat chatter as the **pre-game** layer and crowd+drum as the **lobby buildup** layer. Before the host opens a room, only chatter plays.

### 1. `src/routes/index.tsx` (landing)
- Keep the gesture-gated `startLobbyChatter()` hook.
- **Remove** `startCrowd()` and `startDrumroll()` from the "Host on this screen" `onClick` pre-arm. Leave only `resetAmbience()` + `startLobbyChatter()` so chatter survives the route transition into `/host`. Crowd + drum will start inside `/host` itself (they already do in the lobby effect).

### 2. `src/routes/join.tsx`
- No structural change. Keep the gesture-gated `startLobbyChatter()` already wired.

### 3. `src/lib/ambience-engine.ts`
- Bump `CHATTER_TARGET` from `0.14` to `~0.28` so the murmur is clearly audible on landing/join (where it's the only sound). Crowd (0.18) and drum (0.22) still layer cleanly on top inside `/host`.
- No API changes.

### 4. `src/routes/host.tsx`
- No change. Its lobby effect already calls `startLobbyChatter()` + `startCrowd()` + `startDrumroll()`, which is the correct mix once you're in the room.

## Result

- `/` and `/join`: only chatter (louder, clearly audible) the moment the user taps anywhere.
- `/host` lobby: chatter + crowd + drumroll layered together, same as today.
- Game start: `climaxAndHandoff()` already fades all three out — unchanged.

## Out of scope

- New SFX, mute toggle, or per-route volume controls.
- Changing the announcer banter cadence.
