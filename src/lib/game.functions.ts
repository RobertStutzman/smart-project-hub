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
          question_started_at: new Date().toISOString(),
          question_duration_ms: 15000,
          dropped_indexes: [],
          round_number: nextRound,
          wildcard: "roast",
          roast_candidates: candidates as unknown as object,
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
      throw new Error("No more questions in this category");
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

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "question",
        current_question_id: q.id,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: correctIndex,
        question_started_at: new Date().toISOString(),
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
    if (room.current_correct_index === null || !room.question_started_at) {
      return { ok: false };
    }

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
    };

    const updates: Update[] = [];
    let fastestPlayerId: string | null = null;
    let fastestLockedAt = Number.POSITIVE_INFINITY;

    for (const p of players ?? []) {
      const picked = p.current_answer;
      let roundScore = 0;
      let correct: boolean | null = null;
      let nextStreak = p.streak_count ?? 0;
      let used2x = p.used_2x ?? false;
      const pending2x = p.pending_2x ?? false;

      if (picked === null || picked === undefined) {
        correct = null;
        nextStreak = 0;
        roundScore = 0;
      } else if (picked === correctIdx) {
        correct = true;
        const lockedMs = p.current_answer_locked_at
          ? new Date(p.current_answer_locked_at).getTime()
          : startMs + durationMs;
        const remaining = Math.max(0, durationMs - (lockedMs - startMs)) / 1000;
        let base = Math.round((remaining / (durationMs / 1000)) * MAX_POINTS);
        if (nextStreak >= 3) base = Math.round(base * STREAK_BONUS);
        if (pending2x) {
          base *= 2;
          used2x = true;
        }
        roundScore = base;
        nextStreak += 1;
        if (lockedMs < fastestLockedAt) {
          fastestLockedAt = lockedMs;
          fastestPlayerId = p.id;
        }
      } else {
        correct = false;
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
      });
    }

    if (fastestPlayerId) {
      const u = updates.find((x) => x.id === fastestPlayerId);
      if (u) u.current_round_fastest = true;
    }

    for (const u of updates) {
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
        })
        .eq("id", u.id);
    }

    await supabaseAdmin
      .from("rooms")
      .update({ phase: "reveal" })
      .eq("id", room.id);

    return { ok: true };
  });

export const setPhase = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      phase: z.enum(["lobby", "question", "reveal", "leaderboard", "ended"]),
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
    // Reject if past the timer
    if (room.question_started_at) {
      const elapsed = Date.now() - new Date(room.question_started_at).getTime();
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
