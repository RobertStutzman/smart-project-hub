## Problem

Adult-mode lines ("dipshit", "getting laid", etc.) are playing during the intro even though Adult Mode is supposed to be an explicit opt-in. A family could start a game and get slammed with R-rated content. We need a hard gate at game start so the host explicitly picks a rating before any Vox line plays.

## Goal

Force an explicit **rating selection** at the start of every game/room. Until the host picks one, no persona lines play. Default is family-safe.

## Ratings

- **PG** — default. Standard Elf pool only. Zero profanity, zero innuendo. Safe for kids.
- **PG-13** — Standard Elf pool + a mild-sass subset (light teasing, "heck", "dang", roasts without profanity or sexual content). No Sasha.
- **MA (18+)** — Full adult pool (raunchy Elf + Sasha interjections). Requires the existing age/terms double-confirm.

## UX

1. **Room lobby (host.tsx)**: Add a required "Content rating" selector card at the top of the lobby, above Start Game. Three big buttons: PG / PG-13 / MA 18+. Selection is required before "Start Game" enables.
2. **MA button** routes through the existing `/settings/adult` confirm flow (age + terms) before it can be selected. If they back out, rating falls back to PG.
3. **Persistence**: Rating is stored per-room (Firestore room doc field `contentRating`) so every connected player/host uses the same pool — not just the host's sessionStorage. Also mirrored to sessionStorage for the host's local persona picker.
4. **Visible badge**: Show current rating as a small chip in the host header during the game so it's obvious what mode you're in.
5. **Footer link** to `/settings/adult` stays, but it no longer directly controls in-game content — it just pre-authorizes the MA option.

## Line-pool wiring

- `src/lib/host-persona.ts` `pickPersonaLine`: replace the binary `isAdultMode()` check with a 3-way `getContentRating()` returning `'pg' | 'pg13' | 'ma'`. Pool selection:
  - `pg` → `LINES` (standard) only, filtered to remove any tagged `sass:medium+`
  - `pg13` → `LINES` (standard, full)
  - `ma` → `LINES_ADULT` + Sasha rolls
- Same 3-way switch in `persona-live.ts`, `player-highlights.ts`, `lobby-banter.ts`.
- `src/lib/adult-mode.ts` becomes `content-rating.ts` (keep old export as a shim returning `rating === 'ma'` for back-compat with any missed call site). Versioned key stays so any lingering `btd-adult-mode=1` from testing does NOT auto-promote to MA — user must re-pick.

## Cache

- `elf-voice.ts` cache namespacing already keys on voice; no change needed. PG-13 uses the same baked standard Elf clips as PG (it's a filter, not a new bake).
- MA still uses the `persona-adult-elf` namespace already in place.

## Backstop

Until a rating is chosen, `speakPersona` / `pickPersonaLine` short-circuit and return silent (or fall back to a single neutral "Let's go!" line). This guarantees no adult line ever plays before the host picks.

## Files to change

- `src/lib/adult-mode.ts` — expand to `getContentRating()` / `setContentRating()`, keep `isAdultMode()` shim.
- `src/lib/host-persona.ts` — 3-way pool selection in `pickPersonaLine`; add PG filter.
- `src/lib/persona-live.ts`, `src/lib/player-highlights.ts`, `src/lib/lobby-banter.ts` — use `getContentRating()`.
- `src/routes/host.tsx` — rating selector card in lobby, gate Start Game, persist rating on room doc, show header chip, initialize adult cache only when `ma`.
- `src/routes/settings.adult.tsx` — on confirm, set rating to `ma` (instead of just the boolean flag) and return to `/host`.
- Firestore room doc — new `contentRating` field, read by player views if they also play persona audio.

## Open question

Should I also tag existing standard lines with a `sass` level so PG can strip the spicier-but-clean burns (e.g. "you got dumpstered")? Or is standard-as-is fine for PG and PG-13 is identical to PG? Cheapest path: PG === PG-13 === standard pool, MA === adult pool — two ratings, not three. Let me know which you want before I build.