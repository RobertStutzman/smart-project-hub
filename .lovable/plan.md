## Soundboard rebuild

You want a real soundboard, not just two slots. Here's the plan.

### 1. Fix why the page looks empty

Right now `/admin/sounds` accidentally renders the **Questions** admin page's shell because of how the two route files are nested. Renaming the sounds route so it stands on its own fixes it immediately — no data changes.

### 2. Folders (categories)

A "Folders" sidebar at the top of the page:

- Default folders seeded for you: **Lobby**, **Stings**, **Correct**, **Wrong**, **Reveal**, **Leaderboard**, **Final**, **Victory**, **Audience FX**
- "+ New folder" button to add your own (e.g. "Halloween", "Christmas")
- Click a folder → see every clip in it
- Rename / delete folders inline

### 3. Bulk upload

Inside a folder:

- A big drop zone — drag any number of MP3/WAV files in at once
- Or click to pick multiple files from a folder on your computer
- Per-file progress bars; failures don't block the rest
- Filename becomes the label automatically (you can rename after)

### 4. Event assignments

A separate "Events" panel at the top, one row per event:

```text
Lobby music       [ pick a clip ▾ ]  ► preview   [ volume ] [✓ loop]
Round intro       [ pick a clip ▾ ]  ► preview   [ volume ]
Correct answer    [ pick a clip ▾ ]  ► preview   [ volume ]
Wrong answer      [ pick a clip ▾ ]  ► preview   [ volume ]
Reveal sting      [ pick a clip ▾ ]  ► preview   [ volume ]
Leaderboard       [ pick a clip ▾ ]  ► preview   [ volume ]
Final round       [ pick a clip ▾ ]  ► preview   [ volume ]
Victory           [ pick a clip ▾ ]  ► preview   [ volume ]
```

Each dropdown lets you pick any clip from any folder. Unassigned events fall back to the current synthesized sounds, so nothing breaks if a slot is empty.

Host TV plays the right clip at the right moment (these moments already exist in the game; today they're synth tones).

### 5. Audience soundboard buttons

- Mark any clip with a "Show to audience" toggle
- Those clips appear as labeled buttons on every audience member's phone (in the existing `AudienceSoundboard` component)
- When an audience member taps a button, the **host TV** plays it (rate-limited so people can't spam) — the same pattern your audience reactions already use

### 6. Visual / feel

Same premium dark look as the rest of the app. Folders as pill chips. Clips render as compact rows with waveform-style audio bars (built from a tiny canvas, not a heavy library). Active assignments are highlighted gold to match the host stage accent.

---

### Technical notes

- **Routing fix:** rename `src/routes/_authenticated/admin.sounds.tsx` → `src/routes/_authenticated/admin-sounds.tsx` (URL becomes `/admin-sounds`) and update the link from the admin page. Alternative is to add `<Outlet />` to `admin.tsx`, but that page is a dense single-purpose UI — the rename is cleaner.
- **DB migration:**
  - Add columns to `sound_clips`: `category text not null default 'misc'`, `audience_visible boolean not null default false`, `original_filename text`.
  - New table `sound_event_assignments(event text primary key, clip_id uuid references sound_clips, volume real, loop boolean)`. Admin-only writes, public read.
  - Drop the `slot` enum check (or keep it as legacy "favorite slot" — assignments are the source of truth now).
  - GRANTs + RLS in the same migration.
- **Storage:** keep using the existing `question-media` bucket under a `sounds/<category>/` prefix.
- **Server fns** (extend `src/lib/sounds.functions.ts`): `listFolders`, `createFolder`, `renameFolder`, `deleteFolder`, `bulkRegisterClips`, `setClipAudienceVisible`, `listEventAssignments`, `setEventAssignment`, `getActiveSounds` updated to return one URL per event.
- **Host wiring:** extend `src/lib/sound-engine.ts` with `playEvent('correct'|'wrong'|'reveal'|'leaderboard'|'final'|'victory'|'roundIntro')` that prefers an assigned clip and falls back to the existing synth tones. Call those at the matching transitions inside `HostGameStage.tsx`.
- **Audience trigger:** a Supabase realtime broadcast channel per room (`sfx:<room_id>`) that audience phones publish to and the host TV subscribes to. Server fn validates the clip is `audience_visible`, throttles to one play per 1.5s per audience member.

### Out of scope (ask separately if you want them)

- Waveform editor / trimming clips in-browser
- Auto-ducking lobby music when stings play (can add later if it's worth it)
- Per-room overrides of the global assignments
