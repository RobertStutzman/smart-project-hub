## Goal

Delete the orphan `/admin-tts` page and its only inbound link.

## Steps

1. Delete `src/routes/_authenticated/admin-tts.tsx`.
2. In `src/routes/_authenticated/admin-sounds.tsx` (lines ~900–903), remove the `<Link to="/admin-tts">Open observability dashboard →</Link>` so nothing references the deleted route. Keep the surrounding "circuit breaker / TTS_CAP_PER_GAME" copy.
3. Let the TanStack Router plugin regenerate `routeTree.gen.ts` automatically (no manual edit).

## Out of scope

- Sounds page bake controls — untouched.
- Maintain tab "Did you know?" baker — untouched.
- Any server functions (`bakeAllQuestionTTS`, observability stats, etc.) — left in place; they're still used by other panels.
