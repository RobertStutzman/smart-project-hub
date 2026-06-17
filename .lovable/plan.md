## Fix illegible yellow section labels on Soundboard

The "eyebrow" labels (`EVENT ASSIGNMENTS`, `AUDITION`, `QUESTION VOICEOVERS`, `DYNAMIC LINE CACHE`, etc.) and a few inline accent texts use `text-amber-300/80` — that's a pale yellow tuned for a dark background, but the Soundboard page renders on cream/white, so it disappears. Same problem on the `text-amber-300/80` "Baked" inline label and the catchphrase intro line.

### Change

In `src/routes/_authenticated/admin-sounds.tsx`, swap the unreadable accents for high-contrast amber that works on the cream background:

- `text-amber-300/80` → `text-amber-700` (eyebrow labels at lines 239, 388, 704, 839, 1006, 1099, and the inline "Baked" at 1113)
- `text-amber-300/80` (the small caption at line 272) → `text-amber-700`
- The orange/yellow catchphrase intro line (the 🎙 sentence above the audition card) → `text-amber-700`

Leave the violet eyebrow (`text-violet-300/80` at 941) and pink badges alone — same pale-on-light problem; if you want those fixed too, say the word and I'll bump them to `-700` shades in the same pass. Default is: only fix what you flagged (yellow).

### Not in scope
- No layout or component restructuring.
- No global token changes — this page hardcodes Tailwind colors, so the fix is local. If we want a permanent fix, the follow-up is to introduce a semantic `--eyebrow` token in `src/styles.css` and convert all admin pages, but that's a bigger sweep.

### Verification
- Reload `/admin/sounds` → every section label (`EVENT ASSIGNMENTS`, `AUDITION`, `QUESTION VOICEOVERS`, `EXPLANATION VOICEOVERS`, `DYNAMIC LINE CACHE`) is clearly readable against the cream background.
