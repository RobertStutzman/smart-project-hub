## Goal
Burn expiring ElevenLabs credits into permanent baked audio so the host feels wildly varied without any live-TTS cost during games. Everything flows through the existing `generatePersonaPack` baker → Supabase storage → free URL hits at runtime.

## Scope (in phases so you can stop after any one)

### Phase 1 — Expand the static pools (biggest variety-per-effort)
Files: `src/lib/host-persona.ts`, `src/lib/host-persona.adult.ts`, `src/lib/lobby-banter.ts`, `src/lib/lobby-banter.adult.ts`, `src/lib/round-callouts.ts`, `src/lib/join-banter.ts`.

Grow every existing pool by roughly 4–6×:
- **Host moments** (`LINES` in `host-persona.ts`) — each of the 19 moments goes from ~15–25 lines to ~80–120. Focus on `question_open`, `all_correct`, `all_wrong`, `split_correct`, `elimination`, `idle_interject`, `random_jab`.
- **Lobby banter** — `IDLE_EMPTY / LOW / MID / HIGH / FULL`, `OPENER_LINES`, welcome intros: 3–5× more variants; adult variants matched.
- **Round callouts** — more opener/mid-round variants per slot, more wildcard prefixes, more standings lines. Everything auto-flows through `ALL_ROUND_CALLOUTS`.
- **Join banter** — nickname reactions get a much bigger generic pool.

Estimated bake: ~2,500 new clips (~250k chars). Runs through the existing "Bake Vox catchphrases" button on `/admin-sounds`.

### Phase 2 — Category & difficulty flavor (per-question feel, near-zero authoring)
New file: `src/lib/category-callouts.ts`. Adds two new moment families baked into the persona pack:
- **Pre-question tease per category** (e.g. Science, History, Pop Culture, Sports, Geography, Music, Movies, Food, Tech, Random) — ~15 variants each → ~150 clips. Chosen at question show based on `question.category`.
- **Post-reveal difficulty reactions** — easy/medium/hard × correct/wrong × 10 variants → ~60 clips. Chosen from question difficulty + room result.

Wires into `HostGameStage` where `pickLine("question_open")` already fires, adding a second short line drawn from category or difficulty pool with a debounce so it never overlaps the current opener.

Bake: ~210 clips. Big perceived-variety win because the same 5 openers stop repeating across every question.

### Phase 3 — True per-question quips (optional, uses the most credits)
For each of the ~6k questions, generate one bespoke one-liner (e.g. "Alright, this one's a trap." tailored to the prompt) via `google/gemini-3.6-flash`, then bake TTS. Stored in a new `question_quips` table keyed to `question_id`.

- Author: LLM pass over the question bank (~6k Gemini calls, ~free on Lovable AI).
- Bake: 6k TTS clips (~500k chars).
- Playback: `speakAsElf` prefers `question_quips[id]` if present, else falls back to Phase 2 category tease.

New server fn `generateQuestionQuips` runs in batches of 25 (same pattern as `bakeAllQuestionTTS`), surfaced as a new button on `/admin-sounds`.

### Total budget
Phases 1+2+3 together: ≈ 8.7k baked clips, ~1M characters. Well under your 3M expiring balance, leaves headroom for re-bakes.

## Technical notes
- No schema changes for Phase 1 or 2 — pools live in TS, baker already walks `PERSONA_LINES` + `ALL_ROUND_CALLOUTS` and skips already-baked labels.
- Phase 3 adds one migration: `question_quips (question_id uuid pk, text text, storage_path text, created_at)` with GRANT + RLS.
- All new lines run through the same `generateTTS` + `sound_clips` path so `getPersonaCacheMap` picks them up automatically.
- Adult-mode parity: every new SFW line gets an adult counterpart so `isAdultMode()` still swaps cleanly.
- No changes to gameplay logic beyond one selector tweak in `HostGameStage` for the Phase 2 category/difficulty pick.

## Rollout
After each phase: run "Bake Vox catchphrases" on `/admin-sounds` and confirm the counter climbs; play a game and listen. You can stop after Phase 1 if it already feels fresh enough.

## Recommendation
Do Phase 1 + Phase 2 in one build. They're the highest ratio of perceived variety to complexity, cost <300k chars, and need no schema or new UI. Phase 3 as a follow-up once you've heard the difference.
