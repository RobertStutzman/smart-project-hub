
## Adult Mode (18+)

A per-device opt-in toggle, hidden inside the settings area where someone has to deliberately go look for it. When on, every announcer line pool draws from a spicier "adult" variant — full f-bombs and crude sexual humor, no slurs, no real-person targeting, no minors. When off (default), the existing PG lines are unchanged.

### 1. The toggle — `/settings/adult`

New route `src/routes/settings.adult.tsx`, modeled on `settings.streamer.tsx`:

- Stored in `localStorage` under `btd-adult-mode` (`"1"` or `"0"`). Per-device, no account-level state — matches how streamer mode works.
- Big warning card up top: "Adult Mode — 18+ only. Crude language and sexual humor. Do not enable around minors." Red border, not playful.
- Two-step enable: flip the toggle → confirm dialog ("I am 18 or older and I want this") → only then persist.
- Disable is one click, no confirm.
- A small text line: "Currently OFF — the show stays PG-13" / "Currently ON — gloves off."
- Linked from the existing settings landing (whatever page lists Streamer mode) as its own card with a 🔞 chip. No mention or link from the home page, lobby, or host UI.

### 2. Reading the flag — `src/lib/adult-mode.ts` (new)

Single tiny module:

```ts
export function isAdultMode(): boolean { ... }       // reads localStorage
export function subscribeAdultMode(cb): () => void   // storage event + custom event
```

The host-side queues read it once when picking a line, so toggling mid-game takes effect at the next callout (no live state plumbing needed).

### 3. Adult line pools — `src/lib/*.adult.ts` (new, parallel files)

To keep diffs reviewable and to leave the PG content alone, each existing pool gets a sibling file:

- `src/lib/lobby-banter.adult.ts` — adult versions of `IDLE_EMPTY`, `IDLE_LOW`, `IDLE_MID`, `IDLE_HIGH`, `IDLE_GENERIC`, `IDLE_JOIN_NUDGE`, `WELCOME_INTROS`. Same shape, same `{count}`/`{code}` tokens.
- `src/lib/host-persona.adult.ts` — adult `LINES` map covering every `Moment` already in `host-persona.ts` (intro_hype, question_open, all_correct, all_wrong, first_blood, streak_milestone, elimination, leader_changed, final_hype, credits_open, comeback, round_recap, wooden_spoon, goose_egg, idle_interject, round_transition, last_to_lock, random_jab).
- `src/lib/persona-live.adult.ts` — adult `TEMPLATES` map for each `LiveMoment` (the Tier 1 personalized lines spoken with the player's name).
- `src/lib/player-highlights.adult.ts` — adult `BEST_TEMPLATES`, `WORST_TEMPLATES`, `BEST_VOX`, `WORST_VOX` for credits captions and quips.

Roughly the same line counts as today (~30 intro_hype, ~40 question_open, ~10 per persona-live moment, ~3 per highlight kind) so picker variety stays high.

Content rules baked in at the top of each file as comments and enforced by the writer:
- F-bombs, shit, asshole, bullshit, dick, balls, horny, crude metaphors — yes.
- Slurs of any kind — no.
- Anything sexual involving minors, real public figures, or non-consensual scenarios — no.
- Self-deprecating + roasting the *players* — yes. Targeting protected classes — no.

### 4. Picker wiring — minimal edits to existing files

The selection functions stay where they are; each one gets a one-line branch on `isAdultMode()`:

- `lobby-banter.ts` `pickLobbyLine` / `pickOpener` / `pickWelcomeIntro` → swap pools when adult mode is on.
- `host-persona.ts` `pickLine` → read from the adult `LINES` map.
- `persona-live.ts` `pickTemplate` → read from adult `TEMPLATES`.
- `player-highlights.ts` `derivePlayerHighlights` + `pickHighlightVox` → swap template/vox maps.

The voice cap, TTS cache, tier system, and queueing all stay unchanged — adult lines go through the same Brian voice and the same per-game cap.

### 5. ElevenLabs persona pack

The existing baked `generateAnnouncerPack` server function bakes the PG `VO_LINES` and `ALL_ROUND_CALLOUTS`. Adult mode plays *live* TTS for adult-pool lines (Tier 1 + 2 paths already do this), so no new pre-bake is required to ship. The fallback Tier 3 baked clips will be PG even when adult mode is on — acceptable for v1.

If you later want fully-adult fallback audio, that's a follow-up: add an `ALL_ADULT_LINES` exporter and a `generateAdultPersonaPack` admin function that writes to a `Persona-Adult` folder. **Not in this plan** unless you ask.

### 6. Out of scope

- No account-level setting, no DB column, no RLS work. localStorage only.
- No age-verification beyond the self-attestation confirm dialog.
- No swap of the question content itself — only the announcer chatter.
- No new beats (sponsor reads, callbacks, etc.) — those are still on the table from the previous "more funny" thread, separate plan.

### Verification

1. `/settings/adult` exists, warns clearly, requires the confirm dialog to enable.
2. With adult mode off: lobby, intros, reveals, credits all read identical to today.
3. With adult mode on: open a fresh lobby — idle quips swear, welcome intro swears. Play through — first blood/streak/elimination callouts swear. Credits captions swear.
4. Toggling adult mode off mid-session reverts to PG lines on the next callout.
5. No PG line file is modified (git diff confirms `lobby-banter.ts`/`host-persona.ts`/`persona-live.ts`/`player-highlights.ts` only get the small picker-branch edits).
