# Adult Mode: Rude Vox + Visible Entry + Full Bake

## 1. Rewrite the adult persona to be way ruder

Rewrite `src/lib/host-persona.adult.ts` so Vox goes full late-night-college-roast: heavy cussing, crude jokes, and name-based flirting with common women's names (Sarah, Jess, Ashley, Emma, Maddie, Chloe, Taylor, Bailey, etc.) via a `{flirtName}` token the runtime fills from the current player list.

Tone targets per bucket:
- **Intros / round starts** — crude hype, "let's get this shit rolling"
- **Correct answers** — backhanded compliments, flirty when the player name matches the flirt list ("damn {name}, brains AND that energy?")
- **Wrong answers** — savage roasts, "that was fucking painful to watch"
- **Reveals / leaderboard** — trash talk between players, calls out last place
- **Idle / filler / transitions** — drunk-uncle asides, dumb bits, mild innuendo
- **Game over / victory** — crude sendoffs, "get home safe, you animals"

Hard limits (keep it publishable): no slurs, no sexual content beyond flirty innuendo, no targeting minors, no threats. Cussing (shit, ass, bastard, hell, damn, bitch used playfully in roasts) is in.

Line count: match or exceed the standard pool (~1,700 lines) so every bucket has enough variation that repeats aren't obvious in a full game.

## 2. Flirt-name substitution

Add a tiny runtime helper (in `src/lib/elf-voice.ts` or wherever `speakAsElf` resolves the line) that, when adult mode is active and the chosen line contains `{flirtName}`, picks a matching player name from the current room (case-insensitive match against a flirt-name list) and swaps it in. If no match, fall back to a non-`{flirtName}` line from the same bucket. Cache key includes the resolved name so the baked TTS is per-name.

## 3. Visible entry point

Add a small, tasteful "🔞 Adult Mode" link:
- Home page footer (`src/routes/index.tsx`) — muted text link → `/settings/adult`
- Host pre-game screen — same link near the room settings, so hosts can flip it right before starting

No auto-enable, no scary banner — existing `/settings/adult` double-confirm stays as the gate.

## 4. Bake the full adult pool now

Kick the existing "🥃 Bake ADULT Vox catchphrases" admin button after the rewrite lands. Because `{flirtName}` lines expand per-name, cap the flirt-name list to ~15 common names to keep the bake bounded (roughly +15x on the flirty-bucket subset only, not the whole pool). Rough burn estimate: ~2k–3k TTS calls total. Progress bar already exists.

## Technical notes

- `host-persona.adult.ts` — full rewrite, keep the exported shape identical to `host-persona.ts` so the swap logic doesn't change.
- Flirt-name list lives next to the persona file (`ADULT_FLIRT_NAMES`).
- `speakAsElf` / `initPersonaCacheAdult` — extend cache-key hashing to include resolved flirt name when present.
- Admin bake handler — iterate flirt names for `{flirtName}` lines only; skip token expansion for non-flirty buckets.
- No changes to standard persona, voice IDs, or the adult voice ("Bill").

## Order of work

1. Rewrite `host-persona.adult.ts` (biggest chunk).
2. Add `{flirtName}` resolution in voice runtime + cache key.
3. Extend admin bake handler for name expansion.
4. Add footer + host-screen entry links.
5. Run the bake.
