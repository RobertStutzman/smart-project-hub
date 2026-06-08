import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_POINTS = 1000;
const STREAK_BONUS = 1.1;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resolveMedia(
  mediaUrl: string | null | undefined,
  mediaType: string | null | undefined,
): Promise<{ url: string | null; type: string | null }> {
  if (!mediaUrl || !mediaType) return { url: null, type: null };
  // Already an absolute URL (legacy/manual entry) — pass through.
  if (/^https?:\/\//i.test(mediaUrl)) return { url: mediaUrl, type: mediaType };
  // Treat as a storage path inside the question-media bucket and sign it.
  const { data, error } = await supabaseAdmin.storage
    .from("question-media")
    .createSignedUrl(mediaUrl, 60 * 60);
  if (error || !data) return { url: null, type: null };
  return { url: data.signedUrl, type: mediaType };
}

async function resolveQuestionTTS(ttsPath: string | null | undefined): Promise<string | null> {
  if (!ttsPath) return null;
  const { data, error } = await supabaseAdmin.storage
    .from("question-media")
    .createSignedUrl(ttsPath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

async function resolveExplanationTTS(ttsPath: string | null | undefined): Promise<string | null> {
  if (!ttsPath) return null;
  const { data, error } = await supabaseAdmin.storage
    .from("question-media")
    .createSignedUrl(ttsPath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}


async function getRoomByHost(roomCode: string, hostSessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .eq("host_session_id", hostSessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Room not found or not yours");
  return data;
}

// Wildcards now fire every 3 rounds (rounds 3, 6, 9, 12, 15, 18) rotating
// through 7 types. Round 21 (final) is skipped — final round is its own beat.
type Wildcard =
  | "saboteur"
  | "glitch"
  | "roast"
  | "lightning"
  | "double_or_nothing"
  | "first_blood"
  | "underdog";
const WILDCARD_ROTATION: Wildcard[] = [
  "lightning",         // round 3  — flashy & familiar; easy intro
  "double_or_nothing", // round 6  — first real risk moment
  "saboteur",          // round 9
  "first_blood",       // round 12 — speed pressure mid-game
  "glitch",            // round 15
  "underdog",          // round 18 — catch-up before final stretch
  "roast",             // bonus slot if game extended
];
function wildcardForRound(round: number): Wildcard | null {
  if (round <= 0 || round >= 21) return null; // skip final
  if (round % 3 !== 0) return null;
  const slot = (round / 3) - 1; // 1→0, 2→1, ...
  return WILDCARD_ROTATION[slot % WILDCARD_ROTATION.length];
}

const LIGHTNING_DURATION_MS = 8000;
const LIGHTNING_MULTIPLIER = 2;

const ROAST_PROMPTS = [
  "Who would survive a zombie apocalypse?",
  "Who is most likely to start a cult?",
  "Who would win a hot-dog eating contest?",
  "Who would forget their own birthday?",
  "Who is secretly a time traveller?",
];

export const nextQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    const nextRound = (room.round_number ?? 0) + 1;
    const wildcard = wildcardForRound(nextRound);

    await supabaseAdmin
      .from("players")
      .update({
        current_answer: null,
        current_answer_locked_at: null,
        current_round_score: 0,
        current_round_fastest: false,
        last_answer_correct: null,
      })
      .eq("room_id", room.id);

    // ROAST: top 4 players become "answers"; tally votes, no DB question
    if (wildcard === "roast") {
      const { data: topPlayers } = await supabaseAdmin
        .from("players")
        .select("id, session_id, nickname")
        .eq("room_id", room.id)
        .eq("is_audience", false)
        .order("score", { ascending: false })
        .limit(4);
      const candidates = [...(topPlayers ?? [])];
      while (candidates.length < 4) candidates.push({ id: "", session_id: "", nickname: "—" });
      const prompt = ROAST_PROMPTS[Math.floor(Math.random() * ROAST_PROMPTS.length)];
      const { error } = await supabaseAdmin
        .from("rooms")
        .update({
          status: "playing",
          phase: "question",
          current_question_id: null,
          current_question_text: prompt,
          current_answers: candidates.map((c) => c.nickname),
          current_correct_index: null,
          current_media_url: null,
          current_media_type: null,
          current_question_tts_url: null,
          current_explanation_tts_url: null,
          question_started_at: new Date().toISOString(),
          question_duration_ms: 25000,
          dropped_indexes: [],
          round_number: nextRound,
          wildcard: "roast",
          roast_candidates: JSON.parse(JSON.stringify(candidates)),
          saboteur_session_id: null,
          glitch_active_until: null,
        })
        .eq("id", room.id);
      if (error) throw new Error(error.message);
      return { ok: true, questionId: null, wildcard };
    }

    const { data: used } = await supabaseAdmin
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room.id);
    const usedIds = (used ?? []).map((r) => r.question_id);

    // Pick difficulty to keep an even spread across the game without a predictable order.
    // Strategy: count how many of each difficulty we've already asked this room, then
    // pick randomly among the difficulties that are tied for least-used so far.
    const DIFFICULTIES = ["easy", "medium", "hard", "impossible"] as const;
    const { data: askedRows } = await supabaseAdmin
      .from("room_questions")
      .select("question_id, questions:question_id(difficulty)")
      .eq("room_id", room.id);
    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0, impossible: 0 };
    for (const r of askedRows ?? []) {
      const d = (r as { questions?: { difficulty?: string } | null }).questions?.difficulty;
      if (d && d in counts) counts[d] += 1;
    }
    const minCount = Math.min(...DIFFICULTIES.map((d) => counts[d]));
    const leastUsed = DIFFICULTIES.filter((d) => counts[d] === minCount);
    const targetDifficulty = leastUsed[Math.floor(Math.random() * leastUsed.length)];

    async function fetchPool(difficulty: string | null, useEnabledCategories: boolean) {
      let qQuery = supabaseAdmin.from("questions").select("*");
      const enabled = (room as { enabled_categories?: string[] | null }).enabled_categories;
      if (useEnabledCategories && enabled && enabled.length > 0)
        qQuery = qQuery.in("category", enabled);
      if (difficulty) qQuery = qQuery.eq("difficulty", difficulty);
      if (usedIds.length > 0) qQuery = qQuery.not("id", "in", `(${usedIds.join(",")})`);
      // Global rotation: least-used first, then oldest-used (nulls = never used → top).
      const { data } = await qQuery
        .order("times_used", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .limit(12);
      return data ?? [];
    }


    // Prefer staying inside the host's enabled set; fall back to all categories
    // if that pool runs dry so the game keeps moving.
    let candidates = await fetchPool(targetDifficulty, true);
    if (candidates.length === 0) candidates = await fetchPool(null, true);
    if (candidates.length === 0) candidates = await fetchPool(targetDifficulty, false);
    if (candidates.length === 0) candidates = await fetchPool(null, false);


    if (candidates.length === 0) {
      // Out of questions — end the game gracefully instead of getting stuck.
      await supabaseAdmin
        .from("rooms")
        .update({ phase: "ended", status: "ended" })
        .eq("id", room.id);
      return { ok: true, questionId: null, wildcard: null, exhausted: true };
    }
    const q = candidates[Math.floor(Math.random() * candidates.length)];

    const answers = shuffle([q.correct_answer, q.wrong_1, q.wrong_2, q.wrong_3]);
    const correctIndex = answers.indexOf(q.correct_answer);

    await supabaseAdmin.from("room_questions").insert({
      room_id: room.id,
      question_id: q.id,
    });

    // Bump global rotation counters so this question drops to the bottom of the pool.
    await supabaseAdmin
      .from("questions")
      .update({
        times_used: ((q as { times_used?: number }).times_used ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", q.id);


    let saboteurSessionId: string | null = null;
    if (wildcard === "saboteur") {
      const { data: ps } = await supabaseAdmin
        .from("players")
        .select("session_id")
        .eq("room_id", room.id)
        .eq("is_audience", false);
      const pool = ps ?? [];
      if (pool.length > 0) {
        saboteurSessionId = pool[Math.floor(Math.random() * pool.length)].session_id;
      }
    }

    const media = await resolveMedia(
      (q as { media_url?: string | null }).media_url,
      (q as { media_type?: string | null }).media_type,
    );
    const ttsUrl = await resolveQuestionTTS((q as { tts_path?: string | null }).tts_path);
    const explanationTtsUrl = await resolveExplanationTTS(
      (q as { explanation_tts_path?: string | null }).explanation_tts_path,
    );

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "question",
        current_question_id: q.id,
        current_category: (q as { category?: string | null }).category ?? null,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: media.url,
        current_media_type: media.type,
        current_question_tts_url: ttsUrl,
        current_explanation_tts_url: explanationTtsUrl,
        question_started_at: new Date(Date.now() + 6000).toISOString(),
        question_duration_ms: wildcard === "lightning" ? LIGHTNING_DURATION_MS : 25000,
        dropped_indexes: [],
        round_number: nextRound,
        wildcard: wildcard,
        saboteur_session_id: saboteurSessionId,
        glitch_active_until: null,
        roast_candidates: null,
      })
      .eq("id", room.id);

    if (error) throw new Error(error.message);

    return { ok: true, questionId: q.id, wildcard };
  });

export const dropWrongAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    if (room.phase !== "question" || room.current_correct_index === null) {
      return { ok: false, dropped: null };
    }
    const dropped: number[] = room.dropped_indexes ?? [];
    const candidates = [0, 1, 2, 3].filter(
      (i) => i !== room.current_correct_index && !dropped.includes(i),
    );
    if (candidates.length === 0) return { ok: false, dropped: null };
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const next = [...dropped, pick];
    await supabaseAdmin
      .from("rooms")
      .update({ dropped_indexes: next })
      .eq("id", room.id);
    return { ok: true, dropped: pick };
  });

export const endQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    if (!room.question_started_at) return { ok: false };

    const isRoast = room.wildcard === "roast";
    const isSaboteur = room.wildcard === "saboteur";
    const isLightning = room.wildcard === "lightning";
    const isDoubleOrNothing = room.wildcard === "double_or_nothing";
    const isFirstBlood = room.wildcard === "first_blood";
    const isUnderdog = room.wildcard === "underdog";
    const saboteurSessionId = room.saboteur_session_id ?? null;
    const roastCandidates =
      (room.roast_candidates as { session_id: string; nickname: string }[] | null) ?? null;

    if (!isRoast && room.current_correct_index === null) return { ok: false };

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("is_audience", false);

    const startMs = new Date(room.question_started_at).getTime();
    const durationMs = room.question_duration_ms ?? 15000;
    const correctIdx = room.current_correct_index;

    type Update = {
      id: string;
      score: number;
      current_round_score: number;
      streak_count: number;
      last_answer_correct: boolean | null;
      used_2x: boolean;
      pending_2x: boolean;
      current_round_fastest: boolean;
      correct_count: number;
      wrong_count: number;
      best_streak: number;
      total_response_ms: number;
      answered_count: number;
    };

    const updates: Update[] = [];
    let fastestPlayerId: string | null = null;
    let fastestLockedAt = Number.POSITIVE_INFINITY;

    // Rubber-band: bottom 25% (by current score, pre-update) get a hidden 1.25× boost on correct answers
    const rankedAsc = [...(players ?? [])].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    const rubberCutoff = Math.max(1, Math.floor(rankedAsc.length * 0.25));
    const rubberIds = new Set(rankedAsc.slice(0, rubberCutoff).map((p) => p.id));

    // Underdog wildcard: the single lowest-scoring live player gets a 2x bonus
    // on a correct answer this round. Ties broken by id-stable order.
    const underdogId = isUnderdog && rankedAsc.length > 0 ? rankedAsc[0].id : null;

    // Tally roast votes
    let roastWinnerSessionId: string | null = null;
    if (isRoast && roastCandidates) {
      const tally = [0, 0, 0, 0];
      for (const p of players ?? []) {
        if (typeof p.current_answer === "number" && p.current_answer >= 0 && p.current_answer < 4) {
          tally[p.current_answer]++;
        }
      }
      let max = -1;
      let winIdx = -1;
      tally.forEach((v, i) => {
        if (v > max && roastCandidates[i]?.session_id) {
          max = v;
          winIdx = i;
        }
      });
      if (winIdx >= 0) roastWinnerSessionId = roastCandidates[winIdx].session_id;
    }

    for (const p of players ?? []) {
      const picked = p.current_answer;
      let roundScore = 0;
      let correct: boolean | null = null;
      let nextStreak = p.streak_count ?? 0;
      let used2x = p.used_2x ?? false;
      const pending2x = p.pending_2x ?? false;
      let correctCount = p.correct_count ?? 0;
      let wrongCount = p.wrong_count ?? 0;
      let bestStreak = p.best_streak ?? 0;
      let totalMs = p.total_response_ms ?? 0;
      let answered = p.answered_count ?? 0;

      const lockedMs = p.current_answer_locked_at
        ? new Date(p.current_answer_locked_at).getTime()
        : null;

      if (isRoast) {
        // Roast: winner +500, no penalties, no streak changes
        correct = null;
        if (roastWinnerSessionId && p.session_id === roastWinnerSessionId) {
          roundScore = 500;
        }
      } else if (isSaboteur && p.session_id === saboteurSessionId) {
        // Saboteur: doubled points if they "tricked" — i.e., if any OTHER player picked wrong
        const others = (players ?? []).filter((x) => x.session_id !== saboteurSessionId);
        const trickedCount = others.filter(
          (x) => typeof x.current_answer === "number" && x.current_answer !== correctIdx,
        ).length;
        if (trickedCount > 0) {
          roundScore = trickedCount * 200;
        }
        correct = null;
      } else if (picked === null || picked === undefined) {
        correct = null;
        nextStreak = 0;
        roundScore = 0;
      } else if (picked === correctIdx) {
        correct = true;
        answered += 1;
        correctCount += 1;
        if (lockedMs) totalMs += lockedMs - startMs;
        const remaining = Math.max(0, durationMs - ((lockedMs ?? startMs + durationMs) - startMs)) / 1000;
        let base = Math.round((remaining / (durationMs / 1000)) * MAX_POINTS);
        if (nextStreak >= 3) base = Math.round(base * STREAK_BONUS);
        if (rubberIds.has(p.id)) base = Math.round(base * 1.25); // rubber-banding (hidden)
        if (pending2x) {
          base *= 2;
          used2x = true;
        }
        if (isLightning) base *= LIGHTNING_MULTIPLIER;
        if (isDoubleOrNothing) base *= 2;
        if (isUnderdog && underdogId === p.id) base *= 2;
        roundScore = base;
        nextStreak += 1;
        if (nextStreak > bestStreak) bestStreak = nextStreak;
        if (lockedMs && lockedMs < fastestLockedAt) {
          fastestLockedAt = lockedMs;
          fastestPlayerId = p.id;
        }
      } else {
        correct = false;
        answered += 1;
        wrongCount += 1;
        if (lockedMs) totalMs += lockedMs - startMs;
        // Double-or-Nothing: wrong answer hurts (mirrors the magnitude of a
        // mediocre correct, ~-150). Pending 2x stacks on top.
        let penalty = pending2x ? -200 : 0;
        if (isDoubleOrNothing) penalty += -150;
        if (pending2x) used2x = true;
        roundScore = penalty;
        nextStreak = 0;
      }

      updates.push({
        id: p.id,
        score: Math.max(0, (p.score ?? 0) + roundScore),
        current_round_score: roundScore,
        streak_count: nextStreak,
        last_answer_correct: correct,
        used_2x: used2x,
        pending_2x: false,
        current_round_fastest: false,
        correct_count: correctCount,
        wrong_count: wrongCount,
        best_streak: bestStreak,
        total_response_ms: totalMs,
        answered_count: answered,
      });
    }

    if (fastestPlayerId) {
      const u = updates.find((x) => x.id === fastestPlayerId);
      if (u) u.current_round_fastest = true;
    }

    // First Blood: only the fastest correct player keeps their points; all
    // other correct answers get zeroed (we leave penalties from wrong answers
    // intact). Recompute total score to drop the now-stripped points.
    if (isFirstBlood) {
      for (const u of updates) {
        if (u.last_answer_correct === true && u.id !== fastestPlayerId) {
          const orig = (players ?? []).find((x) => x.id === u.id);
          const prevTotal = orig?.score ?? 0;
          u.current_round_score = 0;
          u.score = Math.max(0, prevTotal);
        }
      }
    }

    let qAnswered = 0;
    let qCorrect = 0;
    let qResponseMs = 0;
    for (const u of updates) {
      const orig = (players ?? []).find((x) => x.id === u.id);
      const fastestCount =
        (orig?.fastest_count ?? 0) + (u.current_round_fastest ? 1 : 0);
      if (!isRoast && !isSaboteur && u.last_answer_correct !== null) {
        qAnswered += 1;
        if (u.last_answer_correct === true) qCorrect += 1;
        const lockedMs = orig?.current_answer_locked_at
          ? new Date(orig.current_answer_locked_at).getTime() - startMs
          : null;
        if (lockedMs !== null && lockedMs >= 0) qResponseMs += lockedMs;
      }
      await supabaseAdmin
        .from("players")
        .update({
          score: u.score,
          current_round_score: u.current_round_score,
          streak_count: u.streak_count,
          last_answer_correct: u.last_answer_correct,
          used_2x: u.used_2x,
          pending_2x: u.pending_2x,
          current_round_fastest: u.current_round_fastest,
          correct_count: u.correct_count,
          wrong_count: u.wrong_count,
          best_streak: u.best_streak,
          total_response_ms: u.total_response_ms,
          answered_count: u.answered_count,
          fastest_count: fastestCount,
        })
        .eq("id", u.id);
    }

    if (qAnswered > 0 && room.current_question_id) {
      const { data: qRow } = await supabaseAdmin
        .from("questions")
        .select("times_answered, times_correct, total_response_ms")
        .eq("id", room.current_question_id)
        .maybeSingle();
      if (qRow) {
        await supabaseAdmin
          .from("questions")
          .update({
            times_answered: ((qRow as { times_answered?: number }).times_answered ?? 0) + qAnswered,
            times_correct: ((qRow as { times_correct?: number }).times_correct ?? 0) + qCorrect,
            total_response_ms: ((qRow as { total_response_ms?: number }).total_response_ms ?? 0) + qResponseMs,
          })
          .eq("id", room.current_question_id);
      }
    }

    await supabaseAdmin
      .from("rooms")
      .update({ phase: "reveal" })
      .eq("id", room.id);

    return { ok: true };
  });

export const triggerGlitch = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, glitch_used, phase")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.glitch_used) throw new Error("Glitch already used");
    if (room.phase !== "question") throw new Error("Not in a question");
    // Verify caller is the last-place non-audience player
    const { data: ranked } = await supabaseAdmin
      .from("players")
      .select("session_id, score")
      .eq("room_id", room.id)
      .eq("is_audience", false)
      .order("score", { ascending: true });
    if (!ranked || ranked[0]?.session_id !== data.sessionId) {
      throw new Error("Only the last-place player can glitch");
    }
    const until = new Date(Date.now() + 5000).toISOString();
    await supabaseAdmin
      .from("rooms")
      .update({ glitch_active_until: until, glitch_used: true })
      .eq("id", room.id);
    return { ok: true, until };
  });

export const endGame = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    await supabaseAdmin
      .from("rooms")
      .update({ phase: "ended", status: "ended" })
      .eq("id", room.id);
    return { ok: true };
  });

export const setPhase = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      phase: z.enum([
        "lobby",
        "intro",
        "question",
        "reveal",
        "leaderboard",
        "ended",
        "credits",
        "final_intro",
        "final_wager",
        "final_question",
        "final_reveal",
        "sudden_death",
      ]),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    await supabaseAdmin
      .from("rooms")
      .update({ phase: data.phase })
      .eq("id", room.id);
    return { ok: true };
  });

// ============================================================
// FINAL ROUND — Wager (Final Jeopardy style)
// ============================================================

export const startFinalRound = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);

    // Reset per-player final fields + comeback flag
    await supabaseAdmin
      .from("players")
      .update({
        final_wager: 0,
        final_answer: null,
        final_locked_at: null,
        current_round_score: 0,
        current_round_fastest: false,
        last_answer_correct: null,
        comeback_bonus: false,
      })
      .eq("room_id", room.id);

    // Visible comeback boost: bottom-3 (non-audience, score > 0) get 1.5× on a correct wager.
    // Skip if there are <=3 active players (everyone would qualify).
    const { data: activePlayers } = await supabaseAdmin
      .from("players")
      .select("id, score")
      .eq("room_id", room.id)
      .eq("is_audience", false)
      .order("score", { ascending: true });
    if (activePlayers && activePlayers.length > 3) {
      const bottomIds = activePlayers.slice(0, 3).map((p) => p.id);
      await supabaseAdmin
        .from("players")
        .update({ comeback_bonus: true })
        .in("id", bottomIds);
    }

    // Pick a fresh question (prefer same category; fall back to any)
    const { data: used } = await supabaseAdmin
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room.id);
    const usedIds = (used ?? []).map((r) => r.question_id);

    let q: {
      id: string;
      question_text: string;
      correct_answer: string;
      wrong_1: string;
      wrong_2: string;
      wrong_3: string;
      category?: string | null;
    } | null = null;
    // Fallback chain for the final round (prefer staying in the selected category):
    //   1. impossible/hard in current category
    //   2. any difficulty in current category
    //   3. impossible/hard in any category
    //   4. any question at all
    const attempts: Array<{ difficulties: string[] | null; useCategory: boolean }> = [
      { difficulties: ["impossible", "hard"], useCategory: true },
      { difficulties: null, useCategory: true },
      { difficulties: ["impossible", "hard"], useCategory: false },
      { difficulties: null, useCategory: false },
    ];
    for (const attempt of attempts) {
      let qQuery = supabaseAdmin.from("questions").select("*");
      const enabled = (room as { enabled_categories?: string[] | null }).enabled_categories;
      if (attempt.useCategory && enabled && enabled.length > 0)
        qQuery = qQuery.in("category", enabled);
      if (attempt.difficulties)
        qQuery = qQuery.in("difficulty", attempt.difficulties);
      if (usedIds.length > 0)
        qQuery = qQuery.not("id", "in", `(${usedIds.join(",")})`);
      // Global rotation: least-used first, then oldest-used.
      const { data: candidates } = await qQuery
        .order("times_used", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .limit(12);
      if (candidates && candidates.length > 0) {
        // Weight 'impossible' 2x over 'hard' when both are in the pool
        const weighted: typeof candidates = [];
        for (const c of candidates) {
          weighted.push(c);
          if ((c as { difficulty?: string }).difficulty === "impossible") weighted.push(c);
        }
        q = weighted[Math.floor(Math.random() * weighted.length)];
        break;
      }
    }
    if (!q) throw new Error("No questions available for the final round");

    const answers = shuffle([q.correct_answer, q.wrong_1, q.wrong_2, q.wrong_3]);
    const correctIndex = answers.indexOf(q.correct_answer);

    await supabaseAdmin.from("room_questions").insert({
      room_id: room.id,
      question_id: q.id,
    });

    // Bump global rotation counters.
    await supabaseAdmin
      .from("questions")
      .update({
        times_used: ((q as { times_used?: number }).times_used ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", q.id);

    const finalMedia = await resolveMedia(
      (q as { media_url?: string | null }).media_url,
      (q as { media_type?: string | null }).media_type,
    );
    const finalTtsUrl = await resolveQuestionTTS((q as { tts_path?: string | null }).tts_path);
    const finalExplanationTtsUrl = await resolveExplanationTTS(
      (q as { explanation_tts_path?: string | null }).explanation_tts_path,
    );

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "final_intro",
        current_question_id: q.id,
        current_category: q.category ?? null,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: finalMedia.url,
        current_media_type: finalMedia.type,
        current_question_tts_url: finalTtsUrl,
        current_explanation_tts_url: finalExplanationTtsUrl,
        question_started_at: null,
        question_duration_ms: 25000,
        dropped_indexes: [],
        wildcard: null,
        saboteur_session_id: null,
        glitch_active_until: null,
        roast_candidates: null,
      })
      .eq("id", room.id);
    if (error) throw new Error(error.message);

    return { ok: true, questionId: q.id };
  });

export const submitWager = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      wager: z.number().int().min(0).max(1000000),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, phase")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.phase !== "final_wager") throw new Error("Wagers are closed");
    const { data: p } = await supabaseAdmin
      .from("players")
      .select("id, score")
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!p) throw new Error("Player not found");
    const wager = Math.max(0, Math.min(data.wager, p.score ?? 0));
    const { error } = await supabaseAdmin
      .from("players")
      .update({ final_wager: wager, final_locked_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) throw new Error(error.message);
    return { ok: true, wager };
  });

export const startFinalQuestion = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    await supabaseAdmin
      .from("rooms")
      .update({
        phase: "final_question",
        question_started_at: new Date().toISOString(),
        question_duration_ms: 25000,
      })
      .eq("id", room.id);
    return { ok: true };
  });

export const lockFinalAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      answerIndex: z.number().int().min(0).max(3),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, phase, question_started_at, question_duration_ms")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.phase !== "final_question") throw new Error("Not accepting answers");
    if (room.question_started_at) {
      const elapsed = Date.now() - new Date(room.question_started_at).getTime();
      if (elapsed > (room.question_duration_ms ?? 25000)) {
        throw new Error("Time's up");
      }
    }
    const { error } = await supabaseAdmin
      .from("players")
      .update({
        final_answer: data.answerIndex,
        final_locked_at: new Date().toISOString(),
      })
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const scoreFinalRound = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    const correctIdx = room.current_correct_index;
    if (correctIdx === null || correctIdx === undefined) {
      throw new Error("No final question set");
    }
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, score, final_wager, final_answer, correct_count, wrong_count, answered_count, comeback_bonus")
      .eq("room_id", room.id)
      .eq("is_audience", false);

    for (const p of players ?? []) {
      const wager = p.final_wager ?? 0;
      const picked = p.final_answer;
      const isCorrect = picked === correctIdx;
      const boost = (p as { comeback_bonus?: boolean }).comeback_bonus ? 1.5 : 1;
      const delta = picked === null || picked === undefined
        ? -wager
        : isCorrect
          ? Math.round(wager * boost)
          : -wager;
      const newScore = Math.max(0, (p.score ?? 0) + delta);
      await supabaseAdmin
        .from("players")
        .update({
          score: newScore,
          current_round_score: delta,
          last_answer_correct: picked === null || picked === undefined ? false : isCorrect,
          answered_count: (p.answered_count ?? 0) + (picked !== null && picked !== undefined ? 1 : 0),
          correct_count: (p.correct_count ?? 0) + (isCorrect ? 1 : 0),
          wrong_count: (p.wrong_count ?? 0) + (!isCorrect && picked !== null && picked !== undefined ? 1 : 0),
        })
        .eq("id", p.id);
    }

    await supabaseAdmin
      .from("rooms")
      .update({ phase: "final_reveal" })
      .eq("id", room.id);
    return { ok: true };
  });

// ============================================================
// SUDDEN DEATH — break a top-tie after final reveal.
// ============================================================

export const startSuddenDeath = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);

    // Find the tied leaders (or carry over an existing sudden-death cohort if still tied)
    const existing = (room.sudden_death_session_ids as string[] | null) ?? [];
    let cohort: string[];
    if (existing.length >= 2) {
      const { data: prev } = await supabaseAdmin
        .from("players")
        .select("session_id, score")
        .eq("room_id", room.id)
        .in("session_id", existing);
      const max = Math.max(...(prev ?? []).map((p) => p.score ?? 0));
      cohort = (prev ?? []).filter((p) => (p.score ?? 0) === max).map((p) => p.session_id);
    } else {
      const { data: standings } = await supabaseAdmin
        .from("players")
        .select("session_id, score")
        .eq("room_id", room.id)
        .eq("is_audience", false)
        .order("score", { ascending: false });
      const top = (standings ?? [])[0]?.score ?? 0;
      cohort = (standings ?? []).filter((p) => (p.score ?? 0) === top).map((p) => p.session_id);
    }

    if (cohort.length < 2) {
      // No tie — nothing to do.
      return { ok: false, reason: "no-tie" as const };
    }

    // Reset cohort answer state
    await supabaseAdmin
      .from("players")
      .update({
        current_answer: null,
        current_answer_locked_at: null,
        last_answer_correct: null,
        current_round_score: 0,
      })
      .eq("room_id", room.id)
      .in("session_id", cohort);

    // Pick an easy/medium tiebreaker question — first-correct wins, no eliminations.
    const { data: used } = await supabaseAdmin
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room.id);
    const usedIds = (used ?? []).map((r) => r.question_id);

    let q: {
      id: string;
      question_text: string;
      correct_answer: string;
      wrong_1: string;
      wrong_2: string;
      wrong_3: string;
    } | null = null;
    const attempts: Array<{ difficulties: string[] | null }> = [
      { difficulties: ["medium", "easy"] },
      { difficulties: null },
    ];
    for (const attempt of attempts) {
      let qQuery = supabaseAdmin.from("questions").select("*");
      if (attempt.difficulties) qQuery = qQuery.in("difficulty", attempt.difficulties);
      if (usedIds.length > 0) qQuery = qQuery.not("id", "in", `(${usedIds.join(",")})`);
      const { data: pool } = await qQuery
        .order("times_used", { ascending: true })
        .order("last_used_at", { ascending: true, nullsFirst: true })
        .limit(12);
      if (pool && pool.length > 0) {
        q = pool[Math.floor(Math.random() * pool.length)];
        break;
      }
    }
    if (!q) throw new Error("No questions available for sudden death");

    const answers = shuffle([q.correct_answer, q.wrong_1, q.wrong_2, q.wrong_3]);
    const correctIndex = answers.indexOf(q.correct_answer);

    await supabaseAdmin.from("room_questions").insert({
      room_id: room.id,
      question_id: q.id,
    });
    await supabaseAdmin
      .from("questions")
      .update({
        times_used: ((q as { times_used?: number }).times_used ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", q.id);

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "sudden_death",
        current_question_id: q.id,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: null,
        current_media_type: null,
        current_question_tts_url: null,
        current_explanation_tts_url: null,
        question_started_at: new Date(Date.now() + 2500).toISOString(),
        question_duration_ms: 12000,
        dropped_indexes: [],
        wildcard: null,
        saboteur_session_id: null,
        glitch_active_until: null,
        roast_candidates: null,
        sudden_death_session_ids: cohort,
      })
      .eq("id", room.id);
    if (error) throw new Error(error.message);

    return { ok: true, cohortSize: cohort.length };
  });

export const resolveSuddenDeath = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    if (room.phase !== "sudden_death") return { ok: false, reason: "wrong-phase" as const };
    const cohort = (room.sudden_death_session_ids as string[] | null) ?? [];
    const correctIdx = room.current_correct_index;
    if (correctIdx === null || correctIdx === undefined) return { ok: false, reason: "no-q" as const };

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, session_id, current_answer, current_answer_locked_at, score")
      .eq("room_id", room.id)
      .in("session_id", cohort);

    // First-correct wins: among those who answered correctly, lowest locked time.
    const correct = (players ?? [])
      .filter((p) => p.current_answer === correctIdx && p.current_answer_locked_at)
      .sort(
        (a, b) =>
          new Date(a.current_answer_locked_at!).getTime() -
          new Date(b.current_answer_locked_at!).getTime(),
      );

    // No-one correct → everyone still tied → keep cohort, host must trigger again.
    if (correct.length === 0) {
      await supabaseAdmin
        .from("rooms")
        .update({ phase: "final_reveal" })
        .eq("id", room.id);
      return { ok: true, resolved: false, stillTied: cohort };
    }

    const fastest = correct[0];
    const ties = correct.filter(
      (c) =>
        new Date(c.current_answer_locked_at!).getTime() ===
        new Date(fastest.current_answer_locked_at!).getTime(),
    );

    if (ties.length === 1) {
      // Award +1 to break the tie cleanly so the winner sits above the others.
      await supabaseAdmin
        .from("players")
        .update({
          score: (fastest.score ?? 0) + 1,
          last_answer_correct: true,
          current_round_score: 1,
        })
        .eq("id", fastest.id);
      await supabaseAdmin
        .from("rooms")
        .update({ phase: "final_reveal", sudden_death_session_ids: [] })
        .eq("id", room.id);
      return { ok: true, resolved: true, winnerSessionId: fastest.session_id };
    }

    // Sub-tie within sudden death: keep the tied subset for another round.
    const stillIn = ties.map((t) => t.session_id);
    await supabaseAdmin
      .from("rooms")
      .update({ phase: "final_reveal", sudden_death_session_ids: stillIn })
      .eq("id", room.id);
    return { ok: true, resolved: false, stillTied: stillIn };
  });

export const lockAnswer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      answerIndex: z.number().int().min(0).max(3),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, phase, dropped_indexes, question_started_at, question_duration_ms")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.phase !== "question") throw new Error("Not accepting answers");
    if ((room.dropped_indexes ?? []).includes(data.answerIndex)) {
      throw new Error("That answer was eliminated");
    }
    // Reject if outside the answer window (before start = read phase, after = time's up)
    if (room.question_started_at) {
      const elapsed = Date.now() - new Date(room.question_started_at).getTime();
      if (elapsed < 0) {
        throw new Error("Read the question first");
      }
      if (elapsed > (room.question_duration_ms ?? 15000)) {
        throw new Error("Time's up");
      }
    }
    const { error } = await supabaseAdmin
      .from("players")
      .update({
        current_answer: data.answerIndex,
        current_answer_locked_at: new Date().toISOString(),
      })
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activate2x = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    const { data: p } = await supabaseAdmin
      .from("players")
      .select("id, used_2x")
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!p) throw new Error("Player not found");
    if (p.used_2x) throw new Error("2x already used this game");
    await supabaseAdmin
      .from("players")
      .update({ pending_2x: true })
      .eq("id", p.id);
    return { ok: true };
  });

// ============================================================
// AI Host Roast — Phase 6: generates a 2-sentence PG-13 summary
// ============================================================
export const generateRoast = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("nickname, score, correct_count, wrong_count, best_streak, fastest_count")
      .eq("room_id", room.id)
      .eq("is_audience", false)
      .order("score", { ascending: false });

    if (!players || players.length === 0) {
      return { roast: "Nobody showed up — even the questions feel embarrassed." };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        roast: `${players[0].nickname} took the crown while everyone else watched in awe (or denial).`,
      };
    }

    const stats = players
      .map(
        (p, i) =>
          `${i + 1}. ${p.nickname}: ${p.score} pts, ${p.correct_count}✓/${p.wrong_count}✗, best streak ${p.best_streak}, fastest ${p.fastest_count}×`,
      )
      .join("\n");

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are a witty PG-13 trivia game show host. Given final stats, write a 2-sentence roast summarizing the game. Name-drop the winner and the funniest stat. Punchy. No emojis. No quotes.",
            },
            { role: "user", content: `Final standings:\n${stats}` },
          ],
        }),
      });
      if (!resp.ok) throw new Error(`AI gateway ${resp.status}`);
      const json = await resp.json();
      const roast: string =
        json?.choices?.[0]?.message?.content?.trim() ??
        `${players[0].nickname} wins; everyone else gets participation trophies.`;
      return { roast };
    } catch {
      return {
        roast: `${players[0].nickname} stole the show — the rest of you were the show's blooper reel.`,
      };
    }
  });
