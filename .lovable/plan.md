## Goal

Add basic legal pages, a consent step before the selfie camera turns on, and auto-delete selfies after 24 hours.

## 1. Legal pages

Three new public routes, each with its own SEO `head()`:

- `src/routes/legal.terms.tsx` → `/legal/terms` — Terms of Service
- `src/routes/legal.privacy.tsx` → `/legal/privacy` — Privacy Policy (explicitly covers: nicknames, selfies stored up to 24h then deleted, room codes, gameplay analytics, Twitch handle if streamer mode used, cookies/localStorage for session)
- `src/routes/legal.contact.tsx` → `/legal/contact` — How to reach you + data deletion request

Starter copy will be sensible defaults (not legal advice — placeholder for "Company / Contact" the user can fill in). Styled to match the existing amber-on-dark theme.

Footer links added to the public pages (`/`, `/join`, `/audience`) — small muted row at the bottom: *Terms · Privacy · Contact*. Not added to host/play/admin (in-game UI stays clean).

## 2. Selfie consent

On `/join`, between the form step and the selfie step, insert a short **consent screen** (still inside `JoinPage`, new `Step = "consent"`):

> **Quick heads up about your photo**
> Your selfie is shown to other players on the TV and in the leaderboard. We store it on our server for up to **24 hours**, then it's automatically deleted. You can skip the selfie and play without one.
>
> By tapping **Allow camera**, you agree to our [Privacy Policy](/legal/privacy).
>
> [ Skip selfie ]   [ Allow camera ]

Only after "Allow camera" do we mount `<SelfieCapture />` (so `getUserMedia` is not called until the user has read the notice). "Skip selfie" goes straight to `/play` with no avatar — already supported by the existing flow.

Also make the existing in-capture **Skip** button equally prominent (it already exists; just a copy tweak: "Play without selfie").

## 3. Auto-delete selfies after 24 hours

Selfies live in the public `avatars` Supabase Storage bucket at `{roomCode}/{sessionId}-{timestamp}.jpg`. The timestamp in the filename gives us the age without extra metadata.

Implementation:

- New server route: `src/routes/api/public/hooks/cleanup-avatars.ts` (POST).
  - Lists files in the `avatars` bucket recursively (paginated).
  - For each file, parse the `-{timestamp}.jpg` suffix; if `Date.now() - timestamp > 24h`, delete it (batched, max 100 per call to `storage.remove`).
  - Also clears `players.avatar_url` for any row whose URL points at a deleted file (best-effort, by matching the path).
  - Returns `{ scanned, deleted }`.
  - Uses `supabaseAdmin` (service role) loaded inside the handler.
- Schedule via `pg_cron` + `pg_net`, hourly, calling the stable URL `https://project--a53d90a6-85a1-4b52-914d-2e46615cb4a6.lovable.app/api/public/hooks/cleanup-avatars` with `apikey` header. Set up via the insert tool (not a migration).

Hourly is enough — worst case a selfie lives ~25h. Cheaper than running every minute and the bucket stays small.

## 4. Privacy Policy wording aligns with reality

The Privacy page will state explicitly:
- Selfies: stored in a public bucket (URL is unguessable but not access-controlled), deleted within 24 hours, used only to display next to your score.
- Nickname & room code: stored for the duration of the game session.
- No account required; no email collected from players.
- localStorage stores a session id to let you rejoin if you refresh.
- Right to request deletion: email link on `/legal/contact`.

## Technical notes

- New files only; no edits to `SelfieCapture.tsx` (just gated behind consent step in `join.tsx`).
- Footer is a small inline component in each public route — no shared layout refactor needed (keeps the change surgical).
- `routeTree.gen.ts` is auto-generated on save; no manual edit.
- No DB schema changes. No new secrets.
- No edits to host/play game flow — players who already joined before the consent screen existed are unaffected (they're past the join step).

## Out of scope

- Cookie/GDPR consent banner (separate, larger task).
- Letting players delete a specific selfie on demand (24h auto-delete covers it for now; contact page handles edge requests).
- Age gating / COPPA flow.
