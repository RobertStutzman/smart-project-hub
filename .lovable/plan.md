## Problem

The "Welcome, <name>!" callout when a player joins is implemented in `src/components/host/HostGameStage.tsx` (lines 131–180). `HostGameStage` only mounts once `roomPhase !== "lobby"` (see `src/routes/host.tsx` ~line 594), so on the QR-code lobby — exactly when players are actually joining — the callout never runs.

## Fix (host route only)

Hoist a lobby-scoped version of the same join-callout effect into `src/routes/host.tsx`, alongside the existing lobby-quip effect (~lines 401–463).

Behavior:
- Track announced player keys in a `useRef<Set<string>>` so each player is welcomed once across the lobby → game transition (share or hand off the set so `HostGameStage` doesn't re-welcome the same players).
- Watch `players` state. For each new non-audience player, enqueue `{ name, sound, key }`.
- Drain queue with a ~600ms debounce so simultaneous joins batch.
- Build the line exactly like HostGameStage does:
  - 1 name: `Welcome, ${name}! ${pickQuip(key)}`
  - 2 names: `Welcome ${a} and ${b}!`
  - 3+ names: `Welcome ${a}, ${b}, and ${c}${overflow > 0 ? \` — and ${overflow} more!\` : "!"}`
- Speak via `speakAsElf(line, { preset: "hype", interrupt: false })` so it queues behind opener/quips without overlap.
- Skip on the replay lobby (reuse the `__btdReplayLobby` flag already read above) — these players were already welcomed in the previous game.
- Suppress play of the per-player funny sound in the lobby (keep that as a game-start moment so the lobby doesn't get noisy). Just the spoken welcome.

Coordination with HostGameStage:
- Move `announcedJoinsRef` to a module-level or context-level `Set` keyed by `room.id`, OR pass the set into `HostGameStage` via a prop / window ref, so when the game starts the in-game effect sees those keys as already announced and doesn't double-welcome.
- Simplest: expose a shared `Set` on `window.__btdAnnouncedJoins` keyed by room id. Both effects read/write it. Clean it up when the room id changes.

## Verification

- Open `/host`, create a room, join with one phone → host TV speaks "Welcome, <nickname>! <quip>" within ~1s.
- Join with two phones nearly simultaneously → single batched "Welcome A and B!" line.
- Start the game → no duplicate welcome for those same players from `HostGameStage`.
- New player joins late (allow-late on, mid-game) → still gets their in-game welcome.
- Hit Play Again → no welcome flood in the replay lobby.

## Files

- `src/routes/host.tsx` — add new useEffect near existing lobby-banter effect; add shared announced-set ref.
- `src/components/host/HostGameStage.tsx` — read from the same shared set in the existing effect (small change, no behavior change for late joiners).
