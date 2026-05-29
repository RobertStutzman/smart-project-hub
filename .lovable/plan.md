## Phase 2 Plan — Host Lobby, Theming & AI Admin

### 1. Host Lobby Polish (`/host`)
- Replace the manual QR `<img>` with `qrcode.react` (`bun add qrcode.react`) for a crisp, themeable QR.
- True split-screen layout: left = brand mark, instructions ("Join at …/join → enter code"), QR + room code; right = animated player roster (Framer Motion enter/exit, avatar gradient) + host controls.
- **Host Controls** card with toggles:
  - **Allow Late Joiners** (writes `rooms.allow_late_joiners`).
  - **Mute Audio** (local-only, persisted to `localStorage`, used by future sound FX).
  - **Theme picker** (Fellowship / Synthwave / Sanctuary) — feeds into the global theme system below.
- **Spacebar pause shortcut**: hidden `keydown` listener calls existing `pauseRoom` server fn; visible "Paused" overlay on host until pressed again.
- Fix current SSR hydration mismatch by deriving `window.location.host` inside `useEffect` (not during render).

### 2. Dynamic Theming + Particle Effects
- Add `data-theme="fellowship|synthwave|sanctuary"` on `<html>`, persisted in `localStorage` and shared host↔mobile via `rooms.theme` (broadcast on host change).
- Extend `src/styles.css` with three full token sets (background, foreground, primary, accent, border, font families, shadow, gradient) scoped under each `[data-theme="…"]` block — no hard-coded colors in components.
- Load theme fonts via `<link>` in `__root.tsx` head: serif (Cormorant) for Fellowship, mono display (Press Start 2P / VT323) for Synthwave, elegant serif (Cinzel) for Sanctuary.
- New `<ThemeParticles />` component (Canvas-based, `requestAnimationFrame`, pauses when tab hidden):
  - **Fellowship**: floating embers + dust motes drifting upward.
  - **Synthwave**: scrolling perspective grid + faint VHS scanline overlay (CSS).
  - **Sanctuary**: slow diagonal light rays (radial gradients animating opacity/position).
- Mount in `__root.tsx` behind all routes so theme is global. Respect `prefers-reduced-motion`.

### 3. Admin Portal (`/admin`) — Auth + CRUD + AI
- **Auth**: enable Supabase email/password + Google sign-in. New `/login` route. Admin gating via a separate `user_roles` table (`app_role` enum + `has_role()` security-definer fn — per security guidelines, never store role on profile).
- **Route**: `src/routes/_authenticated/admin.tsx` protected by `_authenticated` layout (`beforeLoad` redirect) plus child gate that calls a `requireAdmin` server fn (throws redirect if `has_role(uid,'admin')` is false).
- **Questions CRUD dashboard**:
  - Table view with category filter, search, edit/delete inline.
  - Create/edit modal (question, 4 answers, category, subcategory, is_premium, optional media url/type).
  - All writes via `createServerFn` + `requireSupabaseAuth` + admin role check, using `supabaseAdmin`.
- **Drag-and-drop CSV uploader**:
  - Accept CSV with headers `category,subcategory,question_text,correct_answer,wrong_1,wrong_2,wrong_3,media_url,media_type,is_premium`.
  - Parse client-side with `papaparse` (`bun add papaparse`), preview first 10 rows, then bulk-insert via server fn.
- **AI Question Generator**:
  - Prompt input ("10 hard 80s rock questions") + category dropdown + premium toggle.
  - Server fn calls **Lovable AI Gateway** (`google/gemini-3-flash-preview`) with tool-calling for strict JSON schema `{questions: [{question_text, correct_answer, wrong_1..3}]}`.
  - Preview generated rows, admin clicks "Insert all" to persist.
  - Handle 429/402 with friendly toasts.

### 4. Database Migration
- `ALTER TABLE rooms ADD COLUMN allow_late_joiners boolean DEFAULT true, ADD COLUMN theme text DEFAULT 'fellowship';`
- Create `app_role` enum, `user_roles` table (+ GRANTs, RLS, `has_role` SECURITY DEFINER fn).
- Insert-admin helper: SQL snippet the user runs once to grant themselves `admin` after signing up.
- Server-fn-only RLS for `questions` writes (policies: select public; insert/update/delete require `has_role(auth.uid(),'admin')`), plus matching GRANTs.

### 5. Technical notes
- New deps: `qrcode.react`, `papaparse`, `framer-motion` (if not yet), `@types/papaparse`.
- Lovable AI key (`LOVABLE_API_KEY`) is already provisioned — no secret prompt needed.
- All theme tokens defined as semantic CSS variables; components keep using `bg-background`, `text-foreground`, `border-border`, etc.
- Out of scope (Phase 3+): actual gameplay/timers/scoring, paywall checkout, audio playback, media question rendering.

### Open question
Do you want me to wire Google sign-in alongside email/password for admin login (recommended), or email/password only?
