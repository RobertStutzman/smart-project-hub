# Fix answer changes + gate /dev + batch workflow

## Context — why this regressed

Commit `bd0a858` (2026-06-18, a multi-file "Changes" commit that also wired up the glitch-round auto-activate) added an `already_locked` short-circuit to `lockAnswer` under the mistaken belief it was needed to prevent an "everyone gets it right after eliminations" cheat. That cheat was already impossible: `lockAnswer` rejects any tile in `dropped_indexes` (L1320-1322), and streak fairness is already enforced by `current_first_answer` in `scoreRound` (L567-585). The lockout was unnecessary and broke the core Drop Trivia mechanic. This plan reverts it.

## 1. Restore "change your answer" behavior

Players re-tap tiles freely until (a) time runs out, or (b) their current tile is auto-dropped. Only **Final Answer** stays locked-on-first-pick.

### Changes

**`src/lib/game.functions.ts` — `lockAnswer` handler (~L1304-1359)**
- Remove the `already_locked` early return.
- Restore: `firstAnswer = existing?.current_first_answer ?? data.answerIndex` so `current_first_answer` is set once, on the first pick, and preserved on every re-pick.
- Continue rejecting: wrong phase, dropped tile, before `question_started_at`, past `question_duration_ms`.
- `current_answer` and `current_answer_locked_at` update on every valid call.

**`src/routes/play.tsx` (~L388-389)**
- Remove the client early return `if (me?.current_answer !== null …) return;` so tapping a different tile fires a new `lockAnswer`.
- Keep the "your pick got dropped, clear it" flow (L264-279).
- Tiles stay visually enabled while `phase === "question"` and time remains.

**Untouched (correctly locked):** `lockFinalAnswer`, `submitWager`, `submitAsymEntry`, `submitAsymVote`.

### Acceptance
- Sandbox: pick A, then pick B → DB shows `current_answer = B`, `current_first_answer = A`.
- Streak advances only when `current_first_answer === correct`.
- Re-tapping a dropped tile still errors "That answer was eliminated".
- After the timer, re-taps error "Time's up".

## 2. Password-gate `/dev` only

Shared-password gate on the QA harness so `/dev` stays hidden on the live site. Password: `Bigben0919!`. Follows `tanstack-shared-password-gate`.

### Changes
- On approval, call `secrets--add_secret` for `SITE_PASSWORD = Bigben0919!` and `SESSION_SECRET` = 32+ char random.
- New `src/lib/dev-gate.functions.ts` — `unlockDev`, `lockDev`, `requireDevUnlocked` server fns. `useSession` cookie `dev-gate`, 7-day maxAge, httpOnly + secure + sameSite=lax. Hashed `timingSafeEqual` password compare.
- New `src/routes/dev.unlock.tsx` — minimal password form; on success `router.navigate({ to: "/dev" })`.
- `src/routes/dev.tsx` — `beforeLoad` calls `requireDevUnlocked`; on failure `throw redirect({ to: "/dev/unlock" })`. Small "Lock" button in dev header.

Public routes (`/`, `/host`, `/play`, `/lobby`, …) unaffected.

### Acceptance
- `/dev` without cookie → redirects to `/dev/unlock`.
- Wrong password → generic error, no cookie set.
- Correct password → cookie set, redirect to `/dev`, 7-day persistence per device.
- `/dev/unlock` is public (no gate loop).

## 3. Batch-test workflow (confirmation, no code)

- **"Add X to batch test"** → I extend `src/lib/round-runner.ts` (or relevant harness) with the step/assertion/scenario and expose any toggle in `RunnerPanel` if needed.
- **JSON drop** → paste the `RunArtifact` JSON (from `RunnerPanel`'s `?post=1` postMessage or the "Download report" button on `/dev`). I read `events` tail, `logs` (console.error + 4xx/5xx), `snapshots.bots`, `snapshots.room`, `snapshots.assertions`, diagnose, propose the fix, apply on your approval.

Nothing to build for this item.

## Non-goals
- No changes to `lockFinalAnswer`, wager, asym.
- No changes to scoring math or streak rules.
- No gating of `/admin` or public routes.
- No new batch-test scenarios in this pass.

## Technical notes
- `lockAnswer` becomes "upsert of current pick, preserve first pick". `current_first_answer` is the fairness anchor; never overwrite on re-picks.
- Gate uses `useSession` from `@tanstack/react-start/server`. `SITE_PASSWORD` is server-only — never `VITE_`-prefixed.
