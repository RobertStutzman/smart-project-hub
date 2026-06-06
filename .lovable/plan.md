# Add 5 bonus announcer lines

Append to `VO_LINES` in `src/lib/announcer.functions.ts`:

- `vo_new_challenger` — "A new challenger appears!"
- `vo_streak_3` — "Three in a row!"
- `vo_unstoppable` — "Unstoppable!"
- `vo_neck_and_neck` — "It's neck and neck!"
- `vo_blowout` — "It's not even close."

All marked `audienceVisible: true` so they appear in the soundboard for manual play. No event auto-assignment (those slots are already taken by the existing lines). After shipping, hit **Generate AI announcer pack** again to add them to the pack.

## Files touched
- `src/lib/announcer.functions.ts` — append 5 entries

No schema changes, no other files.
