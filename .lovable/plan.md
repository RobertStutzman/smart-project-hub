## Two fixes

### 1. Persona catchphrases never play in-game

`speakPersonaLine` in `src/lib/announcer.functions.ts:408` is gated by `.middleware([requireSupabaseAuth])`. The host page lives at `src/routes/host.tsx` — outside `_authenticated/` — so the host has no Supabase session. The middleware rejects every call with `Unauthorized`, and `elf-voice.ts:77` swallows the error in a silent `catch`. Result: bake worked (admin is authed), playback never fires.

**Fix:** drop the auth middleware from `speakPersonaLine` only. The function already self-protects:
- text is `z.string().min(1).max(600)`
- per-room TTS cap (`tts_calls_count` / `getTtsCap()`) prevents runaway spend
- cache + hash lookups keep generation rare

Leave the other admin/bake server fns (`generatePersonaPack`, `generateAnnouncerPack`, analytics, etc.) auth-protected. No DB schema change.

### 2. Admin Sounds top buttons unreadable

In `src/routes/_authenticated/admin-sounds.tsx:221-234`, both action buttons render the controls in `🎭 Bake persona catchphrases` / `🎙️ Generate AI announcer pack`:
- Bake: `text-amber-200` on `bg-amber-500/10` — near-invisible against the dark card.
- Generate: black text on a bright `from-amber-400 to-pink-500` gradient — glares.

**Fix:** restyle both with solid dark surfaces + high-contrast white text so the labels are legible without screaming. Keep the existing emoji icons and disabled states.
- Bake: solid `bg-amber-600 hover:bg-amber-500 text-white`, subtle ring.
- Generate: solid `bg-pink-600 hover:bg-pink-500 text-white` (drop the gradient; keep it as the visually dominant primary).

## Out of scope

Not auditing every other persona/announcer entry point, not touching the TTS cap or cache, not redesigning the rest of the admin page.