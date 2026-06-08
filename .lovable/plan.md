## Plan for your 10-item list

### 1. Final round talks over itself
**`src/components/host/HostGameStage.tsx`** — the final-round effects fire `playEvent("final_drop")` + an Elf voice line + the next round's announcer line in overlapping timers. Gate every final-phase voice through a single `lastFinalSpeechRef` so each line waits for the previous one to finish, and cancel pending lines if the phase advances early. No new TTS calls during `final_intro` (we removed the duplicate earlier — also verify the top-3 callout doesn't re-fire on re-render via a `finalIntroSpokenRef` guard).

### 2. Remove F / Enter / Space keyboard hints from QR/lobby page
**`src/routes/host.tsx`** lines 738–739, 860, 880 and **`src/components/host/HostOnboarding.tsx`** line 20 — strip the visible `<kbd>` hints and the "Press Space to pause/Enter to start" copy. **Keep the spacebar pause handler active** (line 174) so YOU can still use it during dev/testing — just stop telling players about it.

### 3. Final Round = big spectacle (not beeps)
Generate a custom **"Final Round" ElevenLabs music sting** (~8s, dramatic orchestral hit + bass drop) and a generated **"wager" underscore bed** (~30s loop, tense but cinematic). Upload via `lovable-assets`, wire into `sound-engine.ts` `eventClips.final_drop` and a new `final_underscore` loop. Replace the synth tone loop currently triggered by `startMusic("tense", 520)` during `final_intro`/`final_wager` with the new bed. Add a screen-shake + flash + "FINAL ROUND" type slam in **`FinalStages.tsx`** synced to the sting.

### 4. Audience-mode sounds via ElevenLabs (gross + cartoon + crowd + meme)
Generate ~24 SFX with ElevenLabs `/v1/sound-generation` (8s max each) across all 4 vibes you picked:
- **Gross/funny**: wet fart, long fart, big burp, splat, squelch, snot honk
- **Cartoon**: boing, slide whistle, rimshot, sad trombone, wah-wah, cuckoo
- **Crowd**: stadium boo, gasp, big "awwww", scattered laughter, single clapper, "ohhhh"
- **Meme**: vine boom, sad violin solo, "bruh", record scratch, airhorn, MLG hit-marker

Upload each via `lovable-assets`, store the pointer JSON in `src/assets/audio/audience/`. Build a typed `AUDIENCE_SFX_BANK` in a new `src/lib/audience-sfx.ts`. Rebuild the audience soundboard grid in **`src/routes/play.tsx`** as 4 tabs (Gross / Cartoon / Crowd / Meme) with labeled buttons. The host already plays whatever URL the audience broadcasts via `playClipUrl`, so the host side just works.

### 5. Sci-Fi category on by default
**`src/lib/categories.ts`** line 32 — remove `"Movie Sci-Fi"` from `DEFAULT_OFF_CATEGORIES`.

### 6. Join announcer: name + queued banter + assigned funny sound
**`src/components/host/HostGameStage.tsx`** join effect (lines 105–115):
- Build a `joinAnnounceQueue: string[]` and a `processingJoinRef` flag. Push joining nicknames in; a single async runner drains the queue.
- Runner logic per drain: if 1 player → `"Welcome, {name}!" + random quip`. If 2–3 → `"Welcome {a}, {b}, and {c}!"`. If 4+ in queue → `"Welcome {a}, {b}, {c} — and {n} more!"`.
- After the announcer line resolves, play that player's assigned `funny_sound_id` (already happens for the single-join path — extend to multi).
- Add **~30 quip variants** in a new `src/lib/join-banter.ts` (Tier 1 ElevenLabs-cached): "{name} — finally.", "Look who showed up. {name}.", "{name} just walked in like they own the place.", "Welcome {name}. Try not to embarrass yourself.", "{name}'s here. Game on.", etc.
- Voice queue ensures no overlap even if 6 players join in 200ms.

### 7. Remove visible Admin link, keep `/admin` URL accessible
**`src/routes/host.tsx`** line 617 — delete the `<Link to="/admin">Admin</Link>` button. Also scan/remove any other Admin links across the host UI. Route stays mounted; you reach it by typing `/admin` (or `/admin-sounds`) directly. No password, no key combo — exactly what you asked for.

### 8. Explain "Arm Blind 2×" on the phone
**`src/routes/play.tsx`** line 488 — replace the bare `⚡ Arm Blind 2× for next question` button with: button label `⚡ Blind 2× — risk it` + a small subline `Double your points next question — but you won't see the answers until you lock in.` Add a one-time `?` tooltip/info-bubble that explains it on first appearance. Verify the actual mechanic copy matches what the server does (look at `game.functions.ts`); if the rule is different, use the real rule text.

### 9. Round recap redesign with funny callouts
**`src/components/host/RoundRecapReel.tsx`** — replace the current scoreboard-style recap with a 5-slide hype reel:
1. **"Round N — that's a wrap"** title card (1.5s, sting)
2. **Round MVP** — selfie + score + announcer roast (`mvp` moment, new bank of ~15 lines: "{name} cooked.", "{name} — built different.", etc.)
3. **Wooden Spoon** — last place selfie + gentle roast (~15 lines: "{name} — it's the thought that counts.", "Tough round, {name}. Tougher questions coming.")
4. **Biggest Climb / Biggest Drop** (when there's a notable swing) — "{name} jumped {n} spots!" / "{name} fell off a cliff."
5. **Standings strip** — compact horizontal scroll of top 5 + "You're #X" callout on each player's phone (the phone already has the room state; add a "Your standing" card to **`src/routes/play.tsx`** for the `leaderboard` phase: big rank number, score delta from last round, and which direction they moved).

All new lines go in `src/lib/persona-live.ts` under new moments `mvp`, `wooden_spoon`, `biggest_climb`, `biggest_drop`. Existing `winner` / `wooden_spoon` end-of-game lines stay separate.

### 10. Trivia music back on the lobby/QR screen
The music slot already exists (`eventClips.lobby_music`) — it's empty because nothing's uploaded. Generate a **~60s loopable trivia bed** via ElevenLabs `/v1/music` ("upbeat game-show trivia bed, light percussion, suspenseful but playful, seamless loop, no vocals"). Upload via `lovable-assets`, register the URL in **`src/lib/sounds.functions.ts`** so the sound engine picks it up as `lobby_music`. Confirm `HostGameStage.tsx` line 454–456 keeps the crowd ambience on lobby — actually the user wants MUSIC on lobby, so change that branch to `startMusic("lobby", ...)` (which will now play the real clip) and let the crowd ambience play underneath at low gain, or fully replace the ambience with the music — I'll pick "music primary, ambience ducked to ~30%" for that hype trivia-show feel.

---

## Technical notes

- ElevenLabs API key is already linked via the connector (`ELEVENLABS_API_KEY` server env). All generation runs through a one-off server function (`src/lib/audio-gen.functions.ts`) called from a `/admin-sounds` button — generated bytes go straight to `lovable-assets` and the pointer JSON is committed.
- All new audio assets land in `src/assets/audio/{audience,music,final}/` as `.mp3.asset.json` pointers.
- The voice queue for join announcer reuses the existing Elf voice cache so cost stays at zero for repeated joins.
- Items 1–2, 5, 7, 8 are pure code edits. Items 3, 4, 6, 9, 10 require asset generation — I'll run that once at the top of implementation.

## Result
Final round feels like an event, audience sounds are pro-grade and themed, lobby has its trivia bed back, joins feel hosted (not robotic), recaps are entertainment instead of a spreadsheet, and players actually know what Blind 2× does. Admin stays one URL away from you and invisible to everyone else.