# Add "New room" reset to dev playground

## Problem
The Clear button on `/dev` only empties the local bot list. The host iframe persists its `hostSessionId` in localStorage, so `createRoom` resumes the SAME room every reload — bots from previous runs are still in `players`, and new spawns pile on top.

## Fix

### 1. `src/routes/host.tsx`
- Listen for a `parent:new-room` postMessage from the dev page. On receipt:
  - Clear the persisted host session (`localStorage` host-session key via existing helper, or remove directly).
  - Generate a brand new `hostSessionId`, call `createRoomFn` with it, save it, and `setRoom(...)` with the new room.
  - Reset `initRef` flow safely (use a dedicated `resetRoom` function instead of toggling the ref).
- Post the new `host:room` code/id up to the parent (existing effect already does this on room change).

### 2. `src/routes/dev.tsx`
- Add a "🔄 New room" button next to "Clear" in the toolbar.
- Handler:
  - Clear local bots (`setBots([])`, `lastQRef.current = ""`).
  - Clear current `roomCode`/`roomId` state so the next `host:room` message repopulates them.
  - `iframeRef.current?.contentWindow?.postMessage({ type: "parent:new-room" }, "*")` — add a `ref` to the existing iframe.
- Existing "Clear" stays as bot-only clear; the new button is the full room reset.

## Out of scope
- No DB cleanup of orphaned `players` rows from old rooms (they stay tied to the old room_id, which is harmless — old room just goes stale).
- No backend changes.
