## Rename "persona" → "Vox catchphrases" on the Sounds page

Goal: make it obvious this button bakes host hype lines, not question reads.

### Edits in `src/routes/_authenticated/admin-sounds.tsx`

Button label states (line ~250-256):
- Baking: `🎭 Baking catchphrases…`
- Fully baked: `🎭 Vox catchphrases fully baked (X/Y) — re-bake?`
- Partial: `🎭 Bake X missing Vox catchphrase(s) (baked/total done)`
- Initial: `🎭 Bake Vox catchphrases`

Confirm dialog (line ~175-177):
- With count: `Bake X missing Vox catchphrase(s)? These are the host's hype lines ("Lock in!", "Fingers on buzzers!", round transitions) — not question reads. Already-baked lines are skipped. Calls ElevenLabs — takes ~1 minute.`
- Fallback: `Pre-bake the Vox catchphrases (host hype lines, not question reads)? Already-baked are skipped. Calls ElevenLabs once per missing line. ~1 minute.`

Toast (line 187): `Baked X Vox catchphrases (Y already done)`

Add a one-line helper under the button row clarifying: *"Catchphrases = host hype lines. To narrate questions, use the Question voiceovers panel above."*

### Out of scope
No changes to server functions, file names (`host-persona.ts`, `persona-live.ts`), DB columns, or behavior. Pure label/copy change.