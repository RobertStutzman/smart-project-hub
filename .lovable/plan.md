## Fix: Adult mode uses the original host voice

You're right — Bill was a lame swap. The original host (The Elf, `e79twtVS2278lVZZQiAD`) stays as the main announcer in adult mode too, just delivering the raunchy lines. Sasha (Jessica) remains as the occasional female co-host interjection.

### Changes

1. **`src/lib/announcer.functions.ts`**
   - Delete the `ADULT_VOICE_ID` (Bill) constant.
   - In `generateTTS` voice selection: `"adult"` → use `VOICE_ID` (The Elf), same as standard. Only `"adult_female"` uses Jessica.
   - `generatePersonaPackAdult` bakes with `VOICE_ID` instead of Bill.

2. **Re-bake required**
   - Existing adult catchphrases are baked in Bill's voice and stored under `persona-adult/` with hashes keyed by `adult::...`. After the code change, the cache keys still resolve to those same files, so old Bill audio would keep playing.
   - Plan will: delete existing `PERSONA_CATEGORY_ADULT` rows from `sound_clips` and the `persona-adult/` storage folder so a fresh bake regenerates everything in The Elf's voice. (One-shot admin cleanup — done via a new `resetPersonaPackAdult` server fn triggered by a button in `/admin-sounds`, or run inline if you'd rather I just wipe on next bake.)

3. **No changes to**
   - Sasha / female co-host (Jessica stays).
   - Line content in `host-persona.adult.ts`, `host-persona.xl.adult.ts`, `host-persona.flirty.adult.ts`.
   - Adult-mode toggle, entry points, or client cache wiring.

### Question before I build

For the existing Bill-voiced adult clips already baked, do you want:
- **(a)** Add a "Reset adult pack" button in admin-sounds so you click it once, then re-bake — safest.
- **(b)** Auto-wipe on the next bake — simpler, no extra button.

Default is (a) unless you say otherwise.
