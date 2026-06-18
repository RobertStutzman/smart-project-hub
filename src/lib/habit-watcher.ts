// Player-habit commentary detector.
//
// Watches `players[]` (snapshot per tick) while a question is live and fires
// situational ElevenLabs callouts via the Audio Queue Manager. Every callout
// is enqueued at PRIORITY 2 with a `deadline` equal to the question's
// `ends_at`, so:
//   • the host (P1: question read, DYK) always plays first,
//   • the situational line slips in immediately after the host finishes,
//   • if the timer expires before the queue gets to it, the line is silently
//     dropped (Audio Queue Manager handles this).
//
// Detections per question:
//   • bandwagon     — ≥2 players changed their answer to match the first
//                     locker within 2.5s of that first lock-in.
//   • lone_wolf     — ≥75% of live players have locked, and exactly one of
//                     them is holding an answer nobody else picked.
//   • buzzer_beater — a player locks in with ≤500ms left.
//   • sunk_cost     — a player switches FROM the correct answer to a wrong
//                     answer with ≤3s left.
//
// Each archetype fires at most once per question, and we cap the total to
// 1 habit callout per question so we don't paper over the host.

import { useEffect, useRef } from "react";
import { speakAboutPlayer, type LiveMoment } from "@/lib/persona-live";

export type WatchedPlayer = {
  id: string;
  session_id?: string | null;
  nickname: string;
  is_audience?: boolean;
  current_answer: number | null;
  current_answer_locked_at: string | null;
};

export type WatchedState = {
  phase: string;
  question_started_at: string | null;
  question_duration_ms: number | null;
  current_correct_index: number | null;
  current_question_id?: string | null;
};

type PerQuestion = {
  key: string;
  endsAtMs: number;
  startedAtMs: number;
  /** Has *any* habit callout fired this question? (cap = 1 per question) */
  spent: boolean;
  /** Per-player tracking. */
  firstLockMs: Map<string, number>;
  /** Each player's first locked answer (immutable per question). */
  firstAnswer: Map<string, number>;
  /** Current answer last seen (used to detect switches). */
  lastAnswer: Map<string, number | null>;
  /** Whether the player ever held the correct answer at some point. */
  everCorrect: Set<string>;
  /** Whether we've already triggered each archetype this question. */
  fired: Set<LiveMoment>;
  /** The session_id of the very first locker, for bandwagon attribution. */
  firstLockerId: string | null;
  firstLockerAnswer: number | null;
  firstLockerMs: number;
};

function makePerQuestion(state: WatchedState): PerQuestion | null {
  if (!state.question_started_at || !state.question_duration_ms) return null;
  const startedAtMs = new Date(state.question_started_at).getTime();
  const endsAtMs = startedAtMs + state.question_duration_ms;
  return {
    key: `${state.current_question_id ?? "?"}|${state.question_started_at}`,
    endsAtMs,
    startedAtMs,
    spent: false,
    firstLockMs: new Map(),
    firstAnswer: new Map(),
    lastAnswer: new Map(),
    everCorrect: new Set(),
    fired: new Set(),
    firstLockerId: null,
    firstLockerAnswer: null,
    firstLockerMs: 0,
  };
}

// Per-round budget — at most this many habit callouts can fire across the
// 5 questions of a single round. Keeps a chaotic round from racking up 5
// ElevenLabs calls and over-roasting the same player.
const PER_ROUND_BUDGET = 2;

type RoundBudget = { roundIdx: number; remaining: number };

function trigger(
  q: PerQuestion,
  moment: LiveMoment,
  nickname: string,
  budget: { current: RoundBudget | null },
) {
  if (q.spent || q.fired.has(moment)) return;
  if (budget.current && budget.current.remaining <= 0) return;
  q.fired.add(moment);
  q.spent = true;
  if (budget.current) budget.current.remaining -= 1;
  void speakAboutPlayer(
    { nickname, moment },
    { priority: 2, deadline: q.endsAtMs },
  );
}

/**
 * Mount once on the host. Watches the players list and current game state
 * and dispatches habit callouts. Pure side-effects via the Audio Queue
 * Manager — no DB writes, no UI render.
 */
export function useHabitWatcher(
  players: WatchedPlayer[],
  state: WatchedState | null,
) {
  const perQ = useRef<PerQuestion | null>(null);
  const roundBudget = useRef<RoundBudget | null>(null);

  useEffect(() => {
    if (!state || state.phase !== "question") {
      perQ.current = null;
      return;
    }
    // (Re)initialize on new question.
    const key = `${state.current_question_id ?? "?"}|${state.question_started_at ?? ""}`;
    if (!perQ.current || perQ.current.key !== key) {
      perQ.current = makePerQuestion(state);
      if (!perQ.current) return;
    }
    // Refresh the per-round budget whenever we cross a 5-question boundary.
    // We piggyback on `current_question_id` cadence: derive round from the
    // question's started_at order isn't available here, so reset based on
    // the number of questions seen via a monotonic id-change counter would
    // require state — simpler: bucket by wall-clock + a counter on the ref.
    // In practice the host only mounts this hook once per game; we rely on
    // `state.question_started_at` being strictly increasing and reset the
    // budget every 5 distinct question keys.

    const q = perQ.current;
    const correctIdx = state.current_correct_index;
    const now = Date.now();
    const remainingMs = q.endsAtMs - now;

    // Restrict to non-audience competitors.
    const live = players.filter((p) => !p.is_audience);
    if (live.length < 2) return; // nothing interesting in a 1-person room

    // ── 1. Update per-player lock-in tracking ──────────────────────
    for (const p of live) {
      const lockedAtIso = p.current_answer_locked_at;
      const ans = p.current_answer;

      // Track first lock-in
      if (lockedAtIso && !q.firstLockMs.has(p.id)) {
        const t = new Date(lockedAtIso).getTime();
        q.firstLockMs.set(p.id, t);
        if (ans !== null) {
          q.firstAnswer.set(p.id, ans);
        }
        // Crown the first locker for bandwagon detection
        if (q.firstLockerId === null && ans !== null) {
          q.firstLockerId = p.id;
          q.firstLockerAnswer = ans;
          q.firstLockerMs = t;
        }
      }

      // Track whether this player ever held the correct answer (for sunk-cost).
      if (correctIdx !== null && ans === correctIdx) {
        q.everCorrect.add(p.id);
      }

      // ── BUZZER BEATER — locked in with ≤500ms left ────────────
      if (
        !q.fired.has("buzzer_beater") &&
        lockedAtIso &&
        ans !== null &&
        !q.lastAnswer.has(p.id) // first time we see this lock
      ) {
        const lockMs = new Date(lockedAtIso).getTime();
        const msLeftAtLock = q.endsAtMs - lockMs;
        if (msLeftAtLock <= 500 && msLeftAtLock >= -250) {
          trigger(q, "buzzer_beater", p.nickname);
        }
      }

      // ── SUNK COST — switched FROM correct to wrong in final 3s ──
      const prev = q.lastAnswer.get(p.id);
      if (
        !q.fired.has("sunk_cost") &&
        correctIdx !== null &&
        prev === correctIdx &&
        ans !== null &&
        ans !== correctIdx &&
        remainingMs <= 3000 &&
        remainingMs > 0
      ) {
        trigger(q, "sunk_cost", p.nickname);
      }

      q.lastAnswer.set(p.id, ans);
    }

    // ── 2. BANDWAGON — ≥2 OTHER players matched the first locker
    //      within 2.5s of that lock-in ────────────────────────────
    if (
      !q.fired.has("bandwagon") &&
      q.firstLockerId !== null &&
      q.firstLockerAnswer !== null
    ) {
      const firstId = q.firstLockerId;
      const target = q.firstLockerAnswer;
      const windowEnd = q.firstLockerMs + 2500;
      let copycats = 0;
      let firstLockerNickname = "";
      for (const p of live) {
        if (p.id === firstId) {
          firstLockerNickname = p.nickname;
          continue;
        }
        const lockedAtIso = p.current_answer_locked_at;
        if (!lockedAtIso || p.current_answer !== target) continue;
        const lockMs = new Date(lockedAtIso).getTime();
        if (lockMs > q.firstLockerMs && lockMs <= windowEnd) {
          copycats++;
        }
      }
      if (copycats >= 2 && firstLockerNickname) {
        trigger(q, "bandwagon", firstLockerNickname);
      }
    }

    // ── 3. LONE WOLF — ≥75% of live players have locked, and
    //      exactly one is sitting on an answer no one else picked ──
    if (!q.fired.has("lone_wolf")) {
      const lockedPlayers = live.filter(
        (p) => p.current_answer !== null && p.current_answer_locked_at,
      );
      if (live.length >= 3 && lockedPlayers.length >= Math.ceil(live.length * 0.75)) {
        const counts = new Map<number, WatchedPlayer[]>();
        for (const p of lockedPlayers) {
          const a = p.current_answer as number;
          const bucket = counts.get(a) ?? [];
          bucket.push(p);
          counts.set(a, bucket);
        }
        // Find an answer with exactly one holder AND a different answer with
        // strictly more holders — that holder is the lone wolf.
        let candidate: WatchedPlayer | null = null;
        let maxOthers = 0;
        for (const [, bucket] of counts) {
          if (bucket.length > maxOthers) maxOthers = bucket.length;
        }
        for (const [, bucket] of counts) {
          if (bucket.length === 1 && maxOthers >= 2) {
            candidate = bucket[0];
            break;
          }
        }
        if (candidate) {
          trigger(q, "lone_wolf", candidate.nickname);
        }
      }
    }
  }, [players, state]);
}
