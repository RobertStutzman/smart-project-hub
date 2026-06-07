# Surface Host Moments on the Sounds page

## Problem
The 7 new "in-the-room" moments (welcome roll call, elimination, comeback, recap MVP, final showdown, winner crowning, idle interjections) plus the existing Vox moments (first_blood, leader_changed, streak_milestone, etc.) live only in code (`src/lib/host-persona.ts`, `src/lib/persona-live.ts`). There's no place in the admin UI to see what exists, how many lines each has, or to hear them.

## Plan

### 1. New panel: "Host moments (Vox)"
Add a section to `src/routes/_authenticated/admin-sounds.tsx`, slotted under the existing `TTSCacheStatsPanel`, that lists every moment in a grid:

For each moment row:
- Moment key + friendly label (e.g. `welcome_roll_call` → "Welcome roll call")
- Tier badge: **Baked** (from `LINES` in host-persona.ts) or **Live** (Tier-1 template from persona-live.ts) or **Both**
- Line/template count (e.g. "12 baked lines · 8 live templates")
- One-line description of when it fires (e.g. "Names 2–3 random lobby players entering Round 1")
- **Preview** button → plays a random line via existing `previewAnnouncerLine` server fn (baked) or `speakPersonaLine` (live, with a fake nickname like "Sarah")

### 2. Moment registry
Create `src/lib/host-moments.ts` exporting a single `HOST_MOMENTS` array of:
```ts
{ key, label, description, tier: "baked" | "live" | "both" }
```
This is the single source of truth the panel reads. `LINES` and the live-template map stay where they are; the registry just references them by key for counts.

### 3. No behavior changes
- No new TTS calls outside the explicit Preview button
- No DB migration
- Existing assignments, persona pack baking, announcer pack, and gameplay logic untouched

## Files
- New: `src/lib/host-moments.ts` (registry)
- Edit: `src/routes/_authenticated/admin-sounds.tsx` (new `HostMomentsPanel` component + slot it in)
- Possibly edit: `src/lib/persona-live.ts` to export the template map count helper if not already exposed

## Out of scope
- Editing lines from the UI (read-only for now)
- Per-moment enable/disable toggles
- Changing the Tier 1/2/3 cap
