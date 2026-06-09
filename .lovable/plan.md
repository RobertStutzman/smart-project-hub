## Root cause

`/admin-sounds` calls `listSoundClips`, which signs every clip URL **sequentially** (`for ... await signPath`). The DB currently has **783 clips**, so the server function loops 783 sequential storage calls, blows past the request timeout, and the page never leaves the "Loading…" state. The dev-server log confirms it: `h3 swallowed SSR error: HTTPError`.

## Fix

Replace the per-clip loop in `src/lib/sounds.functions.ts` → `listSoundClips` with one bulk call to Supabase Storage's `createSignedUrls(paths, expires)` API, then zip the results back onto the clips by `path`. Same 6-hour expiry. One network round-trip instead of 783.

```ts
const paths = clips.map(c => c.storage_path);
const { data: signed } = await supabaseAdmin.storage
  .from("question-media")
  .createSignedUrls(paths, 60 * 60 * 6);
const byPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]));
const withUrls = clips.map(c => ({ ...c, signedUrl: byPath.get(c.storage_path) ?? null }));
```

No other files change. No DB / RLS / auth changes. After the edit I'll reload `/admin-sounds` and confirm the list renders.

## Out of scope

- No UI changes.
- No changes to other server functions (they're called on demand, not on initial load).
- No pagination — bulk-sign is enough at this size.
