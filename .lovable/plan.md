# Jackbox-Style Polish for Beat the Drop

A multi-phase plan. Each phase is shippable on its own — you can stop after any one and still have a better game.

## Phase 1 — Boot sequence (the "open the app" moment)

Currently the host lands straight on `/host` and starts creating a room. Jackbox spends 15-20 seconds setting the mood first. We'll add a boot route at `/` that auto-runs before lobby:

```text
[Logo splash 2s]
   ↓ ambient bed music starts
[Credits crawl 4s — "A Beat the Drop production"]
   ↓
[How-to-play teaser 6s — 3 quick illustrated tips]
   ↓
[Press OK / Tap to start]
   ↓ host clicks → /host
```

- New component `BootSequence.tsx` with auto-advancing stages, skippable with any key/click/remote.
- New ambient music loop (low-volume bed) using existing `sound_event_assignments` system — add a `boot_ambient` event slot you can wire to a clip in `/admin-sounds`.
- Replaces the placeholder `/` route content. Current `/host` flow becomes the destination, not the entry.
- Skipped automatically if `?nosplash=1` or if user has booted in last 5 min (sessionStorage), so dev iteration isn't painful.

## Phase 2 — Lobby polish (the "wait for players" moment)

The lobby is what's on-screen longest when guests arrive — Jackbox makes it look alive.

- **Persistent room-code header** — big `JOIN AT [url] · CODE: ABCD` bar pinned to top, visible during lobby AND between rounds AND on the final score screen. Late joiners can always see it.
- **QR code** next to the room code (uses `qrcode` npm package, ~5KB), links to `/join?code=ABCD`. One-tap phone join.
- **Animated player tiles** — each new player bounces in with their nickname, color, and a join sting sound. Existing `players` realtime subscription already fires on insert; just need a transition wrapper.
- **Ambient lobby music + idle background** — looping bed music + the existing `ThemeParticles` already provides movement. Light tuning only.
- **"Waiting for host…" hint** when 1+ player has joined and host hasn't started yet — gentle nudge so the host knows to press OK.

## Phase 3 — How-to-Play sequence

3 auto-advancing illustrated cards before round 1, ~6 sec each, skippable:

1. **"Answer fast, score big"** — illustration of timer + points decay
2. **"Use your 2× wisely"** — illustration of the comeback bonus
3. **"Final round bets your score"** — illustration of the wager mechanic

- New component `HowToPlay.tsx` shown once between lobby → round 1.
- Voice-over optional (uses existing TTS pipeline; cached so it's free on replay).
- "Skip" hint visible in corner — Enter on the remote dismisses early.

## Phase 4 — Audience mode (unlimited spectators)

The DB is already 90% ready: `players.is_audience BOOLEAN` exists. We need to wire the flow.

- **New route `/audience?code=ABCD`** — joiner picks a nickname, joins as `is_audience=true`. No player limit.
- **Existing `/join` becomes player-only**, capped at 8. When room is full, redirect to `/audience` automatically.
- **Audience votes per question** — same A/B/C/D UI but their votes go into a separate aggregate (not scored, no streaks, no 2×).
- **Host TV shows audience tally** as a secondary bar under the main answer reveal: "Audience picked B (62%)" with a small purple bar.
- **DB**: one new column on `room_questions` — `audience_votes integer[4]` (running count). No new tables. Migration includes the GRANT block.
- Players see audience badge on TV between rounds: "👀 24 watching".

## Phase 5 — Between-round transitions + share moment

Small polish to round out the Jackbox feel:

- **"Round 2 of 3" splash** with theme sting (you have round splashes — tighten timing and add the sting).
- **End-of-game share card** — winner spotlight already exists; add a QR code that links to a public results page `/results/$roomId` so players can scan and remember their score. The page reuses the existing winner spotlight component.
- **Credits reel** (existing `CreditsStage.tsx`) auto-plays after the share card, then loops back to the boot splash for the next game.

## What we're NOT doing in this plan

- Building the Android APK (separate effort, on your computer — guide comes after this is polished).
- Submitting to Amazon Appstore (Phase 6, after the in-app experience is locked).
- Player avatars / character selection beyond nicknames (worth a follow-up if you want full Jackbox parity).
- Continuous background music throughout *gameplay* (distracting during questions; only lobby + boot + between rounds).

## Recommended order to ship

1. **Phase 1 + 2 together** (boot + lobby) — biggest visible upgrade, no DB changes, ~one session.
2. **Phase 3** (how-to-play) — small, satisfying.
3. **Phase 4** (audience mode) — one migration, moderate code. Test with 10+ phones in a real room before considering it done.
4. **Phase 5** (transitions + share) — final polish.
5. **Then** the APK + Amazon submission as a separate effort.

## Open questions before I start

- **Music**: do you have ambient loop files in mind, or should I add an empty `boot_ambient` and `lobby_ambient` slot in `/admin-sounds` for you to upload to later?
- **Phase 1's "press OK to start"**: should it auto-advance after, say, 8 seconds of no input (so a kid running the Firestick doesn't get stuck), or strictly wait for input?
- **Audience cap**: hard cap at, say, 50 spectators per room to protect realtime bandwidth, or truly unlimited?
