# Swap announcer to The Elf

## Change
In `src/lib/announcer.functions.ts`:

1. `VOICE_ID` → `"e79twtVS2278lVZZQiAD"` (The Elf)
2. In `voice_settings`:
   - `stability`: `0.35` → `0.2` (more unhinged, expressive)
   - `style`: `0.7` → `0.9` (max cartoon-host energy)

That's it — one file, three values.

## After shipping
Click **Generate AI announcer pack** in Admin → Soundboard to rebuild all 16 VO clips with the new voice.
