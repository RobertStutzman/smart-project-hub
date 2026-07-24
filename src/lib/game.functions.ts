import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_POINTS = 1000;
const STREAK_BONUS = 1.1;
// Grace window at the very start of a question: any lock within this many
// ms of `question_started_at` is treated as if it happened at t=0 and yields
// full points. Without this, network roundtrip + reaction time make a true
// 1000 unreachable (Kahoot/HQ use the same idea).
const POINTS_GRACE_MS = 1500;


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

// Read the secret correct-answer index for a room. Lives in a server-only
// table so anonymous clients can't poll it during the question phase.
async function getSecretCorrectIndex(roomId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("room_secrets")
    .select("correct_index")
    .eq("room_id", roomId)
    .maybeSingle();
  return (data as { correct_index: number | null } | null)?.correct_index ?? null;
}

async function setSecretCorrectIndex(roomId: string, correctIndex: number | null) {
  await supabaseAdmin
    .from("room_secrets")
    .upsert({ room_id: roomId, correct_index: correctIndex, updated_at: new Date().toISOString() });
}

// Wildcards fire on the last question of each 5-question "round" — i.e.
// questions 5, 10, 15, 20. Per game we shuffle the full deck (deterministic
// from room.id) and deal the first 4 into those slots, so every game gets a
// fresh order with no repeats. Q21 (final) is always skipped.
import { wildcardDeckForRoom, type Wildcard } from "./wildcards";
import {
  pickAsymSlotForRoom,
  pickAsymFormatForRoom,
  type AsymFormat,
} from "./asymmetry";
function wildcardForRound(round: number, roomId: string): Wildcard | null {
  if (round <= 0 || round >= 21) return null; // skip final
  if (round % 5 !== 0) return null;
  const slot = (round / 5) - 1; // 5→0, 10→1, 15→2, 20→3
  const deck = wildcardDeckForRoom(roomId);
  return deck[slot] ?? null;
}


const LIGHTNING_DURATION_MS = 8000;
const LIGHTNING_MULTIPLIER = 2;
const SUDDEN_DROP_DURATION_MS = 12000;
const SUDDEN_DROP_MULTIPLIER = 1.5;
const HEIST_STEAL = 50;
const MAX_ROUND_MULTIPLIER = 3; // ceiling on stacked correct-answer multipliers
/** Extra delay before question_started_at when a wildcard explainer must play first. */
const WILDCARD_INTRO_PAD_MS = 7000;

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

    // ── Asymmetry round (one per game, slots 8–17) ───────────────────────
    // Pick & persist slot+format on first invocation. Then, when the next
    // round would land on that slot AND we haven't consumed the format yet,
    // enter the intro phase (announcer explainer + banner) WITHOUT bumping
    // the round counter. `finishAsymIntro` clears the format and the host
    // calls nextQuestion again to play the regular question on that slot.
    type AsymRoom = {
      asym_slot_index: number | null;
      asym_format: string | null;
      asym_prompt: string | null;
    };
    const asymRoom = room as unknown as AsymRoom;
    let asymSlot = asymRoom.asym_slot_index;
    let asymFormat = asymRoom.asym_format as AsymFormat | null;
    if (asymSlot === null) {
      asymSlot = pickAsymSlotForRoom(room.id);
      asymFormat = pickAsymFormatForRoom(room.id);
      await supabaseAdmin
        .from("rooms")
        .update({ asym_slot_index: asymSlot, asym_format: asymFormat })
        .eq("id", room.id);
    }
    const nextRound = (room.round_number ?? 0) + 1;
    if (asymFormat && asymSlot !== null && nextRound === asymSlot) {
      const { data: prompts } = await supabaseAdmin
        .from("asymmetry_prompts")
        .select("prompt")
        .eq("format", asymFormat);
      const pool = prompts ?? [];
      const prompt =
        pool.length > 0
          ? pool[Math.floor(Math.random() * pool.length)].prompt
          : "(no prompt available)";
      await supabaseAdmin
        .from("rooms")
        .update({
          phase: "asym_intro",
          asym_prompt: prompt,
          asym_phase_started_at: new Date().toISOString(),
        })
        .eq("id", room.id);
      return { ok: true, asymIntro: true, format: asymFormat, prompt };
    }
    // ─────────────────────────────────────────────────────────────────────

    const wildcard = wildcardForRound(nextRound, room.id);

    await supabaseAdmin
      .from("players")
      .update({
        current_answer: null,
        current_answer_locked_at: null,
        current_first_answer: null,
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
          question_started_at: new Date(Date.now() + WILDCARD_INTRO_PAD_MS).toISOString(),
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
      await setSecretCorrectIndex(room.id, null);
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
    // If the host locked a single-difficulty Mode, skip the spread and use that.
    const DIFFICULTIES = ["easy", "medium", "hard", "impossible"] as const;
    const lockedMode = (room as { difficulty_mode?: string | null }).difficulty_mode ?? null;
    let targetDifficulty: string;
    if (lockedMode && (DIFFICULTIES as readonly string[]).includes(lockedMode)) {
      targetDifficulty = lockedMode;
    } else {
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
      targetDifficulty = leastUsed[Math.floor(Math.random() * leastUsed.length)];
    }

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
    // if that pool runs dry so the game keeps moving. When a mode is locked we
    // keep the difficulty constraint as long as possible before dropping it.
    let candidates = await fetchPool(targetDifficulty, true);
    if (candidates.length === 0) candidates = await fetchPool(targetDifficulty, false);
    if (!lockedMode) {
      if (candidates.length === 0) candidates = await fetchPool(null, true);
      if (candidates.length === 0) candidates = await fetchPool(null, false);
    } else {
      // Last-resort safety net so a tiny pool never dead-ends the game.
      if (candidates.length === 0) candidates = await fetchPool(null, true);
      if (candidates.length === 0) candidates = await fetchPool(null, false);
    }



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

    // Sudden Drop: pre-eliminate one wrong tile so only 2 answers are shown.
    let preDropped: number[] = [];
    if (wildcard === "sudden_drop") {
      const wrongs = [0, 1, 2, 3].filter((i) => i !== correctIndex);
      preDropped = [wrongs[Math.floor(Math.random() * wrongs.length)]];
    }

    const durationMs =
      wildcard === "lightning"
        ? LIGHTNING_DURATION_MS
        : wildcard === "sudden_drop"
          ? SUDDEN_DROP_DURATION_MS
          : 20000;

    // Wildcard rounds need extra lead-time so the announcer explainer plays
    // before the question read; non-wildcard rounds keep the original 6s.
    const startDelayMs = wildcard ? 6000 + WILDCARD_INTRO_PAD_MS : 6000;

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        status: "playing",
        phase: "question",
        current_question_id: q.id,
        current_category: (q as { category?: string | null }).category ?? null,
        current_question_text: q.question_text,
        current_answers: answers,
        current_correct_index: null, // kept secret until reveal; stored in room_secrets
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: media.url,
        current_media_type: media.type,
        current_question_tts_url: ttsUrl,
        current_explanation_tts_url: explanationTtsUrl,
        question_started_at: new Date(Date.now() + startDelayMs).toISOString(),
        question_duration_ms: durationMs,
        dropped_indexes: preDropped,
        round_number: nextRound,
        wildcard: wildcard,
        saboteur_session_id: saboteurSessionId,
        // Glitch round: auto-activate the screen-scramble for the entire
        // question window so the round visibly does something without
        // requiring the last-place player to manually tap the button.
        glitch_active_until:
          wildcard === "glitch"
            ? new Date(Date.now() + startDelayMs + durationMs).toISOString()
            : null,
        glitch_used: wildcard === "glitch" ? true : false,
        roast_candidates: null,
      })
      .eq("id", room.id);

    if (error) throw new Error(error.message);

    await setSecretCorrectIndex(room.id, correctIndex);

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
    const secretIdx = await getSecretCorrectIndex(room.id);
    if (room.phase !== "question" || secretIdx === null) {
      return { ok: false, dropped: null };
    }
    // Lightning round: no auto-drops. Players answer right or wrong, no help.
    if (room.wildcard === "lightning") {
      return { ok: false, dropped: null };
    }
    const dropped: number[] = room.dropped_indexes ?? [];
    const candidates = [0, 1, 2, 3].filter(
      (i) => i !== secretIdx && !dropped.includes(i),
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
    // Re-entry guard: only score while the room is still in the question phase.
    // Prevents double-scoring from host refresh / two tabs / timer+manual race.
    if (room.phase !== "question") return { ok: false, alreadyScored: true };


    const isRoast = room.wildcard === "roast";
    const isSaboteur = room.wildcard === "saboteur";
    const isLightning = room.wildcard === "lightning";
    const isDoubleOrNothing = room.wildcard === "double_or_nothing";
    const isFirstBlood = room.wildcard === "first_blood";
    const isUnderdog = room.wildcard === "underdog";
    const isSuddenDrop = room.wildcard === "sudden_drop";
    const isHeist = room.wildcard === "heist";
    const saboteurSessionId = room.saboteur_session_id ?? null;
    const roastCandidates =
      (room.roast_candidates as { session_id: string; nickname: string }[] | null) ?? null;

    const secretIdx = await getSecretCorrectIndex(room.id);
    if (!isRoast && secretIdx === null) return { ok: false };

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("room_id", room.id)
      .eq("is_audience", false);

    const startMs = new Date(room.question_started_at).getTime();
    const durationMs = room.question_duration_ms ?? 15000;
    const correctIdx = secretIdx;

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
        // Roast: winner +500, no penalties, no streak changes. Still count the
        // vote as an answer for participation stats (correctness stays null).
        correct = null;
        if (typeof picked === "number") answered += 1;
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
        if (typeof picked === "number") answered += 1;
      } else if (picked === null || picked === undefined) {
        correct = null;
        nextStreak = 0;
        roundScore = 0;
      } else if (picked === correctIdx) {
        correct = true;
        answered += 1;
        correctCount += 1;
        if (lockedMs) totalMs += lockedMs - startMs;
        const elapsedMs = Math.max(0, (lockedMs ?? startMs + durationMs) - startMs - POINTS_GRACE_MS);
        const remaining = Math.max(0, durationMs - elapsedMs) / 1000;
        let base = Math.round((remaining / (durationMs / 1000)) * MAX_POINTS);

        // Streak credit only if their FIRST locked answer was also correct.
        // Players who changed their pick after a wrong initial lock get the
        // points but their streak resets — the streak should reward
        // confident first-try knowledge, not trial-and-error.
        const firstWasCorrect =
          (p as { current_first_answer?: number | null }).current_first_answer === correctIdx;

        if (nextStreak >= 3 && firstWasCorrect) base = Math.round(base * STREAK_BONUS);
        if (rubberIds.has(p.id)) base = Math.round(base * 1.25); // rubber-banding (hidden)
        if (pending2x) {
          base *= 2;
          used2x = true;
        }
        if (isLightning) base *= LIGHTNING_MULTIPLIER;
        if (isDoubleOrNothing) base *= 2;
        if (isUnderdog && underdogId === p.id) base *= 2;
        if (isSuddenDrop) base = Math.round(base * SUDDEN_DROP_MULTIPLIER);
        roundScore = base;
        if (firstWasCorrect) {
          nextStreak += 1;
          if (nextStreak > bestStreak) bestStreak = nextStreak;
        } else {
          nextStreak = 0;
        }
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

    // Heist: if any non-leader got it right, the current leader is robbed of
    // HEIST_STEAL points (single deduction per round). The leader is safe if
    // they themselves answered correctly.
    if (isHeist) {
      // Pre-round leader = highest score before this round's updates applied.
      const sortedByPrev = [...(players ?? [])].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0),
      );
      const leader = sortedByPrev[0];
      if (leader) {
        const leaderUpdate = updates.find((x) => x.id === leader.id);
        const leaderGotItRight = leaderUpdate?.last_answer_correct === true;
        const anyNonLeaderCorrect = updates.some(
          (u) => u.last_answer_correct === true && u.id !== leader.id,
        );
        if (!leaderGotItRight && anyNonLeaderCorrect && leaderUpdate) {
          leaderUpdate.score = Math.max(0, leaderUpdate.score - HEIST_STEAL);
          leaderUpdate.current_round_score -= HEIST_STEAL;
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

    // Reveal: now safe to expose the correct answer publicly.
    await supabaseAdmin
      .from("rooms")
      .update({ phase: "reveal", current_correct_index: correctIdx })
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
    // Fallback chain for the final round — TRUE hard/impossible only.
    //   1. impossible/hard in current category
    //   2. impossible/hard in any category
    //   3. any question (last resort if pool is empty)
    const attempts: Array<{ difficulties: string[] | null; useCategory: boolean }> = [
      { difficulties: ["impossible", "hard"], useCategory: true },
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
        current_correct_index: null, // secret until final_reveal
        current_explanation: (q as { explanation?: string | null }).explanation ?? null,
        current_media_url: finalMedia.url,
        current_media_type: finalMedia.type,
        current_question_tts_url: finalTtsUrl,
        current_explanation_tts_url: finalExplanationTtsUrl,
        question_started_at: null,
        question_duration_ms: 30000,
        dropped_indexes: [],
        wildcard: null,
        saboteur_session_id: null,
        glitch_active_until: null,
        roast_candidates: null,
      })
      .eq("id", room.id);
    if (error) throw new Error(error.message);

    await setSecretCorrectIndex(room.id, correctIndex);

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
        question_duration_ms: 30000,
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
    const correctIdx = await getSecretCorrectIndex(room.id);
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
      .update({ phase: "final_reveal", current_correct_index: correctIdx })
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
        current_first_answer: null,
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
        current_correct_index: null, // secret until final_reveal
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

    await setSecretCorrectIndex(room.id, correctIndex);

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
    const correctIdx = await getSecretCorrectIndex(room.id);
    if (correctIdx === null || correctIdx === undefined) return { ok: false, reason: "no-q" as const };
    // Now safe to reveal publicly.
    await supabaseAdmin
      .from("rooms")
      .update({ current_correct_index: correctIdx })
      .eq("id", room.id);

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
      if (elapsed > (room.question_duration_ms ?? 20000)) {
        throw new Error("Time's up");
      }
    }
    // Capture the FIRST answer the player committed to this question.
    // Streak credit (see scoreRound) only applies when this matches the
    // correct index — players who change their pick after locking still
    // get points for the new pick, but lose streak eligibility.
    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("id, current_first_answer")
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId)
      .maybeSingle();
    const firstAnswer =
      existing?.current_first_answer ?? data.answerIndex;
    const { error } = await supabaseAdmin
      .from("players")
      .update({
        current_answer: data.answerIndex,
        current_answer_locked_at: new Date().toISOString(),
        current_first_answer: firstAnswer,
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

// ============================================================
// RESTART GAME — wipe per-game state, keep room + players
// ============================================================

export const restartGame = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);

    // Reset room-level per-game state.
    await supabaseAdmin
      .from("rooms")
      .update({
        phase: "lobby",
        status: "lobby",
        round_number: 0,
        current_category: null,
        current_question_id: null,
        current_question_text: null,
        current_answers: null,
        current_correct_index: null,
        current_explanation: null,
        current_explanation_tts_url: null,
        current_question_tts_url: null,
        current_media_url: null,
        current_media_type: null,
        question_started_at: null,
        dropped_indexes: [],
        wildcard: null,
        saboteur_session_id: null,
        glitch_active_until: null,
        glitch_used: false,
        roast_candidates: null,
        sudden_death_session_ids: [],
        is_paused: false,
      })
      .eq("id", room.id);

    // Reset per-player game state. Keep identity (nickname, avatar, team, session_id, is_audience).
    await supabaseAdmin
      .from("players")
      .update({
        score: 0,
        current_round_score: 0,
        current_round_fastest: false,
        streak_count: 0,
        best_streak: 0,
        last_answer_correct: null,
        current_answer: null,
        current_answer_locked_at: null,
        current_first_answer: null,
        correct_count: 0,
        wrong_count: 0,
        fastest_count: 0,
        total_response_ms: 0,
        answered_count: 0,
        used_2x: false,
        pending_2x: false,
        final_wager: 0,
        final_answer: null,
        final_locked_at: null,
        comeback_bonus: false,
      })
      .eq("room_id", room.id);

    // Per-room asked-question history is intentionally preserved across Play
    // Again so the same crew never sees a repeat. The global rotation +
    // category-drop fallback in pickQuestion handles long-lived rooms.

    return { ok: true };
  });

/**
 * Asymmetry intro complete — clear the format so the next `nextQuestion`
 * call falls through to a regular question pick on the same slot.
 * Phase 1 stub: future phases will transition into `asym_submit` instead.
 */
export const finishAsymIntro = createServerFn({ method: "POST" })
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
        asym_format: null,
        asym_prompt: null,
        asym_phase_started_at: null,
      })
      .eq("id", room.id);
    return { ok: true };
  });

// ============================================================
// ASYMMETRY ROUND — submit / vote / reveal full loop
// ============================================================

import { computeAsymDeltas, type AsymSubmissionPayload } from "./asymmetry";

const ASYM_SUBMIT_MS: Record<string, number> = {
  crowd_pleaser: 45000,
  finish_sentence: 45000,
  two_truths: 60000,
  hot_take: 15000,
};
const ASYM_VOTE_MS = 20000;
const ASYM_REVEAL_MS = 9000;

function pickAsymSource(roomId: string, round: number, liveSessionIds: string[]): string | null {
  if (liveSessionIds.length === 0) return null;
  const seed = `asym-src:${roomId}:${round}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return liveSessionIds[h % liveSessionIds.length];
}

/**
 * Transition asym_intro → asym_submit. Bumps round_number, picks the source
 * for two_truths, clears prior submissions/votes, sets the submit deadline.
 */
export const startAsymRound = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    const fmt = (room as { asym_format?: string | null }).asym_format ?? null;
    if (!fmt) throw new Error("No asym format set");
    if (room.phase !== "asym_intro") throw new Error("Not in asym_intro");

    const { data: live } = await supabaseAdmin
      .from("players")
      .select("session_id")
      .eq("room_id", room.id)
      .eq("is_audience", false);
    const sessionIds = (live ?? []).map((p) => p.session_id);
    const source = fmt === "two_truths" ? pickAsymSource(room.id, room.round_number ?? 0, sessionIds) : null;

    const dur = ASYM_SUBMIT_MS[fmt] ?? 45000;
    const endsAt = new Date(Date.now() + dur).toISOString();
    await supabaseAdmin
      .from("rooms")
      .update({
        phase: "asym_submit",
        round_number: (room.round_number ?? 0) + 1,
        asym_source_session_id: source,
        asym_submissions: {},
        asym_votes: {},
        asym_phase_ends_at: endsAt,
        asym_phase_started_at: new Date().toISOString(),
      })
      .eq("id", room.id);
    return { ok: true };
  });

const submitPayloadSchema = z.object({
  text: z.string().max(160).optional(),
  choice: z.enum(["agree", "disagree"]).optional(),
  statements: z.array(z.string().max(120)).length(3).optional(),
  lieIndex: z.number().int().min(0).max(2).optional(),
});

export const submitAsymEntry = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      payload: submitPayloadSchema,
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, phase, asym_format, asym_submissions, asym_source_session_id")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.phase !== "asym_submit") throw new Error("Not accepting submissions");
    const fmt = room.asym_format as string | null;
    const payload = data.payload;
    if (fmt === "two_truths") {
      if (room.asym_source_session_id !== data.sessionId) {
        throw new Error("Only the source may submit statements");
      }
      if (!payload.statements || typeof payload.lieIndex !== "number") {
        throw new Error("Invalid two-truths payload");
      }
    } else if (fmt === "hot_take") {
      if (!payload.choice) throw new Error("Pick agree or disagree");
    } else {
      if (!payload.text || !payload.text.trim()) throw new Error("Empty submission");
    }
    const subs = (room.asym_submissions as Record<string, AsymSubmissionPayload> | null) ?? {};
    subs[data.sessionId] = payload as AsymSubmissionPayload;
    await supabaseAdmin
      .from("rooms")
      .update({ asym_submissions: subs })
      .eq("id", room.id);
    return { ok: true };
  });

export const submitAsymVote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      vote: z.union([z.string().max(128), z.number().int().min(0).max(2)]),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, phase, asym_votes, asym_source_session_id, asym_format")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.phase !== "asym_vote") throw new Error("Not in vote phase");
    if (typeof data.vote === "string" && data.vote === data.sessionId) {
      throw new Error("Cannot vote for yourself");
    }
    const votes = (room.asym_votes as Record<string, string | number> | null) ?? {};
    votes[data.sessionId] = data.vote;
    await supabaseAdmin
      .from("rooms")
      .update({ asym_votes: votes })
      .eq("id", room.id);
    return { ok: true };
  });

/**
 * Auto-advance the asym state machine one step:
 *   asym_submit → asym_vote (or asym_reveal for hot_take)
 *   asym_vote   → asym_reveal (computes + persists scores)
 *   asym_reveal → leaderboard (clears asym_*)
 */
export const advanceAsymPhase = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const room = await getRoomByHost(data.roomCode, data.hostSessionId);
    const fmt = (room as { asym_format?: string | null }).asym_format as
      | "crowd_pleaser"
      | "two_truths"
      | "hot_take"
      | "finish_sentence"
      | null;

    if (room.phase === "asym_submit") {
      if (!fmt) throw new Error("No format");
      if (fmt === "hot_take") {
        return await finalizeAsymReveal(room.id, fmt, room);
      }
      const endsAt = new Date(Date.now() + ASYM_VOTE_MS).toISOString();
      await supabaseAdmin
        .from("rooms")
        .update({ phase: "asym_vote", asym_phase_ends_at: endsAt })
        .eq("id", room.id);
      return { ok: true, phase: "asym_vote" };
    }

    if (room.phase === "asym_vote") {
      if (!fmt) throw new Error("No format");
      return await finalizeAsymReveal(room.id, fmt, room);
    }

    if (room.phase === "asym_reveal") {
      await supabaseAdmin
        .from("rooms")
        .update({
          phase: "leaderboard",
          asym_format: null,
          asym_prompt: null,
          asym_submissions: null,
          asym_votes: null,
          asym_source_session_id: null,
          asym_phase_ends_at: null,
          asym_phase_started_at: null,
        })
        .eq("id", room.id);
      return { ok: true, phase: "leaderboard" };
    }

    return { ok: false };
  });

async function finalizeAsymReveal(
  roomId: string,
  fmt: "crowd_pleaser" | "two_truths" | "hot_take" | "finish_sentence",
  roomRow: Record<string, unknown>,
) {
  const { data: live } = await supabaseAdmin
    .from("players")
    .select("id, session_id, score, current_round_score")
    .eq("room_id", roomId)
    .eq("is_audience", false);
  const sessionIds = (live ?? []).map((p) => p.session_id);
  const subs =
    ((roomRow as { asym_submissions?: Record<string, AsymSubmissionPayload> | null }).asym_submissions) ??
    {};
  const votes =
    ((roomRow as { asym_votes?: Record<string, string | number> | null }).asym_votes) ??
    {};
  const source =
    ((roomRow as { asym_source_session_id?: string | null }).asym_source_session_id) ??
    null;
  const deltas = computeAsymDeltas(fmt, sessionIds, source, subs, votes);

  // Persist scores
  for (const p of live ?? []) {
    const delta = deltas[p.session_id] ?? 0;
    await supabaseAdmin
      .from("players")
      .update({
        score: (p.score ?? 0) + delta,
        current_round_score: delta,
        last_answer_correct: delta > 0,
      })
      .eq("id", p.id);
  }

  const endsAt = new Date(Date.now() + ASYM_REVEAL_MS).toISOString();
  await supabaseAdmin
    .from("rooms")
    .update({
      phase: "asym_reveal",
      asym_phase_ends_at: endsAt,
    })
    .eq("id", roomId);
  return { ok: true, phase: "asym_reveal", deltas };
}
