# Premium Polish + Soundboard

Two changes: a Soundboard admin area you upload clips to, and host TV wiring so the lobby and round intros play them.

## 1. Soundboard storage + admin page

New table `sound_clips`:
- `slot` — short code identifying *where* the clip plays. Starts with two slots: `lobby_loop` and `round_intro`. Easy to add more later.
- `label` — your friendly name (e.g. "Saturday Night Live theme")
- `storage_path` — file in the existing `question-media` bucket under `sounds/{uuid}.mp3`
- `is_active` — only one active clip per slot. When you upload a new one, others in that slot flip inactive.
- `volume` — 0–1, defaults to 0.6 for lobby loop, 1.0 for stings
- `loop` — bool, defaults true for `lobby_loop`, false for `round_intro`

New admin route `/admin/sounds` with two sections (Lobby loop, Round intro), each showing:
- The active clip (label + inline `<audio controls>` preview)
- "Upload new" button → file picker → uploads + makes active
- A list of past uploads for that slot with "Make active" / "Delete" buttons

Server functions (`src/lib/sounds.functions.ts`):
- `listSoundClips` — admin only, all slots
- `getActiveSounds` — **public**, returns signed URLs for every active clip keyed by slot. Host TV calls this once on mount.
- `uploadSoundClip` — admin only, takes path + slot + label, flips others inactive
- `setActiveClip`, `deleteSoundClip`

## 2. Host TV playback

New hook `useSoundboard()` in `src/lib/useSoundboard.ts`:
- Fetches `getActiveSounds` once
- Exposes `play(slot)` and `stop(slot)`
- For `lobby_loop`: looping `<audio>` element at the slot's volume
- For `round_intro`: one-shot, fires, auto-stops after natural end

**Lobby screen** (`src/components/host/HostLobby.tsx` — find it):
- On mount, if `lobby_loop` exists → `play("lobby_loop")`
- On unmount or when phase changes away from lobby → `stop("lobby_loop")`
- Small mute toggle bottom-right (TVs sometimes need it killed for the room)

**Round intro** (`src/components/host/HostGameStage.tsx`):
- Detect `round_number` increment in the room state
- When it goes up AND phase becomes `question`: `stop("lobby_loop")` (cheap insurance) + `play("round_intro")`
- The existing "Round 3: Movies!" overlay timing already gives the sting ~3s to breathe

## 3. Audio unlock

Browsers block autoplay before any user interaction. The host already clicks "Start game" to get into the lobby, which satisfies it — but to be safe, the host home screen adds a one-time silent unlock on first click (plays + immediately pauses a 1-frame silent buffer).

## Out of scope

- Question countdown bed / reveal stings — skipped per your selection. Easy to add later by introducing new slots (`countdown_bed`, `correct_sting`, `wrong_sting`) — the schema is generic.
- Per-room music customization — all rooms share the active clip set.
- Crossfading between lobby loop and intro sting — hard cut for now.
- Payments / paid tiers — separate workstream, not in this round.

## Files touched

- `supabase/migrations/...` — new `sound_clips` table + RLS + grants
- `src/lib/sounds.functions.ts` (new)
- `src/lib/useSoundboard.ts` (new hook)
- `src/routes/_authenticated/admin.sounds.tsx` (new admin page)
- `src/routes/_authenticated/admin.tsx` — add a "Sounds" nav link
- `src/components/host/HostLobby.tsx` — wire lobby loop + mute toggle
- `src/components/host/HostGameStage.tsx` — wire round intro on round change
