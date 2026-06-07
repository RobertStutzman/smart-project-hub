# Vox in the room: live personalization + presence

Two layers: (1) live ElevenLabs callouts with budget cap + tiered fallback, (2) new moments that make Vox feel present beyond reaction lines.

---

## Layer 1: Live personalized callouts with tiered fallback

**New file: `src/lib/persona-live.ts`**

A small client-side helper that owns the per-game cap, tier state, and the actual `speakAsElf` call. Acts as the single entrypoint for any moment that wants to say a player's name.

```ts
// Tier thresholds (per game)
const TIER_FULL_LIVE_MAX = 15;   // Calls 1-15: full custom sentence
const TIER_NAME_PREFIX_MAX = 30; // Calls 16-30: "Name!" + baked catchphrase
                                 // Calls 31+:   baked catchphrase only, no name

type PersonaContext = {
  nickname: string;
  moment: "first_blood" | "leader_changed" | "streak" | "elimination" | "comeback" | "round_recap" | "welcome" | "winner";
  // Optional flavor data the live tier can weave in:
  streak?: number;
  rank?: number;
  pointsBehind?: number;
  roundNumber?: number;
};

// Returns the appropriate string for current tier, plays it through the
// shared voice queue, increments the counter.
export function speakAboutPlayer(ctx: PersonaContext): Promise<void>
```

**Tier logic (in `speakAboutPlayer`):**

- **Tier 1 (calls 1–15) — full live:** call a new server fn `generatePersonalizedLine` that picks a moment template (e.g. `"{name}'s on a {streak}-streak — somebody stop them"`), fills in `nickname` + flavor, then live-TTSs the whole sentence on ElevenLabs. Played via `playVoiceUrl` once the audio URL returns.
- **Tier 2 (calls 16–30) — name prefix:** today's behavior. One short live TTS of just `"${nickname}!"` (cached per-nickname per-game — repeats are free), concatenated in the voice queue with a baked `pickLine(moment, qid)`.
- **Tier 3 (calls 31+) — baked only:** `speakPersona(pickLine(moment, qid))`. No name. Zero credits.

Counter resets per `roomId`. Stored in a module-level `Map<roomId, count>`. Reset by an exported `resetLiveCap(roomId)` called from `HostGameStage` when a new game starts (phase transition `lobby → question`).

**New server fn: `src/lib/announcer.functions.ts` → `generatePersonalizedLine`**

```ts
.inputValidator((data: { nickname: string; moment: string; flavor: {...}; roomId: string }) => data)
.handler(async ({ data }) => {
  // 1. Pick a template for the moment (server-side template pool, ~10 per moment)
  const template = pickTemplate(data.moment);
  const text = fillTemplate(template, data.nickname, data.flavor);
  // 2. Charge per-room cap (reuses existing TTS_DEFAULT_CAP=50 infra)
  const allowed = await chargeRoomTtsCap(data.roomId);
  if (!allowed) return { skipped: true };
  // 3. Live ElevenLabs call (eleven_turbo_v2_5 — half price), returns base64
  const audio = await elevenLabsTts(text, ELF_VOICE_ID, "hype");
  return { audioBase64: audio, text };
});
```

Per-room cap is the existing `TTS_DEFAULT_CAP=50` ceiling already enforced by `speakPersonaLine`. We add an additional **client-side** tier cap (15/30) for tighter control over the personalized-call subset specifically.

**Wire-in points in `HostGameStage.tsx`:**

Replace the 2 existing name-prefix calls with `speakAboutPlayer`:

- `first_blood` effect (line ~494): `speakAboutPlayer({ nickname: firstCorrect.nickname, moment: "first_blood" })`
- `leader_changed` effect (line ~515): `speakAboutPlayer({ nickname: top.nickname, moment: "leader_changed", rank: 1 })`
- `streak_milestone` (line ~468): wrap into `speakAboutPlayer({ nickname: topStreaker.nickname, moment: "streak", streak: topStreaker.streak_count })`

---

## Layer 2: New presence moments (make Vox feel in the room)

All of these route through `speakAboutPlayer` so they respect the cap automatically.

### A. Welcome roll call (lobby → first question)
When the game starts, Vox names 2–3 random players from the lobby:
> "We've got Sarah, Mike, and Jordan tonight. May the best brain win."

One call, names of up to 3 random `players[]`. Fires once on `lobby → question` transition.

### B. Elimination callouts (wrong answer dropped)
Hook into the existing `dropWrongAnswer` server fn. When a player gets eliminated from a round (or just answers wrong on a high-stakes question), Vox names them:
> "Mike. Out. Cold."

Fires only on confirmed wrong + high-confidence "they locked in" (locked + final lock was the wrong index). Throttled to max 1 per question to avoid spam.

### C. Comeback alerts (uses existing `comeback_bonus` field)
When a player who was 3+ ranks down jumps into top 3, Vox notices:
> "Wait — Sarah just clawed back from the bottom. Threat level rising."

Computed at leaderboard phase by comparing previous rank snapshot to current. Refs `previousRankRef`.

### D. Round recap callouts (replaces generic round transition)
At end of each round, Vox calls out the round MVP (highest `current_round_score`):
> "Round 2 belonged to Jordan. The rest of you — adjust."

Fires once per round on `leaderboard` phase, alongside the existing leader-changed logic.

### E. Final showdown personalized hype (replaces generic `final_hype`)
Before the final question, name the top 3:
> "Sarah, Mike, Jordan — one question between you and the crown. Don't blow it."

One live call, ~80 chars, fires once.

### F. Winner crowning (credits open)
After winner is decided, before credits roll:
> "Your winner: Sarah. Tonight, the brain reigned supreme."

Fires once at game end. Replaces a generic `credits_open` line.

### G. Idle interjections (dead air filler)
If the host hasn't advanced phase in 20+ seconds during lobby/leaderboard, Vox tosses out a generic baked line ("Take your time. Nobody's getting younger."). **No live call needed** — just enables existing baked lines on a timer. Free.

---

## Tier cap budget check

Worst case in a 12-question game with all 7 new moments firing:
- Welcome: 1
- First blood: ~12 (one per question)
- Eliminations: ~6 (rough avg)
- Streak: ~3 (only milestones)
- Comeback: ~2
- Round recap: ~3 (one per round)
- Leader change: ~3
- Final hype: 1
- Winner: 1
- **Total ceiling: ~32 personalized calls per game**

With our 15/30 tier cap:
- First 15 = ~900 chars live (full custom sentences)
- Next 15 = ~150 chars live (just names, ~10 chars each) + baked catchphrases (free)
- Remainder = 100% baked, free

Worst-case live TTS per game: ~1,050 characters ≈ **$0.00–$0.0002 on Creator plan**. Effectively zero.

---

## Out of scope

- No DB migration (uses existing room/player columns)
- No change to `TTS_DEFAULT_CAP=50` server-side cap (still active as safety net)
- No new voice (still The Elf)
- No changes to round splash / question splash visuals
- Persona pack baking unchanged

## Files touched

- **NEW** `src/lib/persona-live.ts` — tier logic, `speakAboutPlayer`, cap tracking
- `src/lib/announcer.functions.ts` — add `generatePersonalizedLine` server fn + template pools
- `src/components/host/HostGameStage.tsx` — replace existing 3 name calls with `speakAboutPlayer`; wire 7 new moments (welcome, elimination, comeback, round recap, final hype, winner, idle)
- `src/lib/host-persona.ts` — add new moment types to enum if any catchphrase pools need them as baked fallback

## After implementation

- Same one-time bake of `LINES` pool in `/admin-sounds` (already done)
- New tier 1 lines are generated live per-game per-player — nothing to pre-bake
- Test with a 2-player + 5-player + 12-player game to verify tier transitions feel natural
