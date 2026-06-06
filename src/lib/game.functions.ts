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

function wildcardForRound(round: number): "saboteur" | "glitch" | "roast" | null {
  if (round === 5) return "saboteur";
  if (round === 10) return "glitch";
  if (round === 14) return "roast";
  return null;
}

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
          question_started_at: new Date().toISOString(),
          question_duration_ms: 15000,
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

    let qQuery = supabaseAdmin.from("questions").select("*");
    if (room.current_category) qQuery = qQuery.eq("category", room.current_category);
    if (usedIds.length > 0) qQuery = qQuery.not("id", "in", `(${usedIds.join(",")})`);
    const { data: candidates } = await qQuery.limit(50);
    if (!candidates || candidates.length === 0) {
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

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "question",
        current_question_id: q.id,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: media.url,
        current_media_type: media.type,
        question_started_at: new Date(Date.now() + 5000).toISOString(),
        question_duration_ms: 15000,
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
        const penalty = pending2x ? -200 : 0;
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

    for (const u of updates) {
      const orig = (players ?? []).find((x) => x.id === u.id);
      const fastestCount =
        (orig?.fastest_count ?? 0) + (u.current_round_fastest ? 1 : 0);
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
        "question",
        "reveal",
        "leaderboard",
        "ended",
        "final_intro",
        "final_wager",
        "final_question",
        "final_reveal",
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

    // Reset per-player final fields
    await supabaseAdmin
      .from("players")
      .update({
        final_wager: 0,
        final_answer: null,
        final_locked_at: null,
        current_round_score: 0,
        current_round_fastest: false,
        last_answer_correct: null,
      })
      .eq("room_id", room.id);

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
    } | null = null;
    // Fallback chain for the final round:
    //   1. impossible/hard in current category
    //   2. impossible/hard in any category
    //   3. any difficulty in current category
    //   4. any question at all
    const attempts: Array<{ difficulties: string[] | null; useCategory: boolean }> = [
      { difficulties: ["impossible", "hard"], useCategory: true },
      { difficulties: ["impossible", "hard"], useCategory: false },
      { difficulties: null, useCategory: true },
      { difficulties: null, useCategory: false },
    ];
    for (const attempt of attempts) {
      let qQuery = supabaseAdmin.from("questions").select("*");
      if (attempt.useCategory && room.current_category)
        qQuery = qQuery.eq("category", room.current_category);
      if (attempt.difficulties)
        qQuery = qQuery.in("difficulty", attempt.difficulties);
      if (usedIds.length > 0)
        qQuery = qQuery.not("id", "in", `(${usedIds.join(",")})`);
      const { data: candidates } = await qQuery.limit(100);
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

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "final_intro",
        current_question_id: q.id,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
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
      .select("id, score, final_wager, final_answer, correct_count, wrong_count, answered_count")
      .eq("room_id", room.id)
      .eq("is_audience", false);

    for (const p of players ?? []) {
      const wager = p.final_wager ?? 0;
      const picked = p.final_answer;
      const isCorrect = picked === correctIdx;
      const delta = picked === null || picked === undefined
        ? -wager
        : isCorrect
          ? wager
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
