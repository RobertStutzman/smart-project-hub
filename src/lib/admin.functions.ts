import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dedupeKey, normalizeAnswer } from "@/lib/dedupe";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data, userId };
  });

export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const PAGE = 1000;
    type QRow = Awaited<
      ReturnType<typeof supabaseAdmin.from<"questions">>
    > extends never
      ? never
      : Record<string, unknown>;
    const all: QRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as QRow[];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return { questions: all, total: all.length };
  });

const DIFFICULTY = z.enum(["easy", "medium", "hard", "impossible"]);

function answersAreDistinct(q: {
  correct_answer: string;
  wrong_1: string;
  wrong_2: string;
  wrong_3: string;
}) {
  const norm = (s: string) => s.trim().toLowerCase();
  const set = new Set([norm(q.correct_answer), norm(q.wrong_1), norm(q.wrong_2), norm(q.wrong_3)]);
  return set.size === 4;
}

/**
 * Strip garbage tokens (stray CJK / control chars) the AI sometimes appends
 * to short English answer strings in tool-call output. If the string is
 * mostly ASCII, we drop any trailing run of non-ASCII characters. Strings
 * that are genuinely non-Latin (e.g. a Japanese title) are left alone.
 */
function sanitizeAnswer(s: string): string {
  if (!s) return s;
  let out = s.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const ascii = out.replace(/[^\x20-\x7e]/g, "");
  if (ascii.length >= Math.max(3, Math.floor(out.length * 0.6))) {
    out = out.replace(/[^\x00-\x7f]+$/u, "").trim();
    out = out.replace(/\s*[\/,;|]\s*$/u, "").trim();
  }
  return out;
}

function sanitizeQuestion<T extends {
  question_text: string;
  correct_answer: string;
  wrong_1: string;
  wrong_2: string;
  wrong_3: string;
  explanation?: string | null;
}>(q: T): T {
  return {
    ...q,
    question_text: sanitizeAnswer(q.question_text),
    correct_answer: sanitizeAnswer(q.correct_answer),
    wrong_1: sanitizeAnswer(q.wrong_1),
    wrong_2: sanitizeAnswer(q.wrong_2),
    wrong_3: sanitizeAnswer(q.wrong_3),
    explanation: q.explanation ? sanitizeAnswer(q.explanation) : q.explanation,
  };
}


const QuestionInput = z
  .object({
    category: z.string().min(1).max(60),
    subcategory: z.string().max(60).optional().nullable(),
    question_text: z.string().min(3).max(500),
    correct_answer: z.string().min(1).max(200),
    wrong_1: z.string().min(1).max(200),
    wrong_2: z.string().min(1).max(200),
    wrong_3: z.string().min(1).max(200),
    explanation: z.string().max(500).optional().nullable(),
    difficulty: DIFFICULTY.default("medium"),
    media_url: z.string().max(500).optional().nullable(),
    media_type: z.enum(["image", "audio", "video"]).optional().nullable(),
    is_premium: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    if (!answersAreDistinct(q)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All four answer options must be distinct (case-insensitive).",
        path: ["correct_answer"],
      });
    }
  });

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid().optional(), q: QuestionInput }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("questions")
        .update(data.q)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("questions")
      .insert(data.q)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkInsertQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ rows: z.array(QuestionInput).min(1).max(1000) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error, count } = await supabaseAdmin
      .from("questions")
      .insert(data.rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { ok: true, inserted: count ?? data.rows.length };
  });

/**
 * Return the normalized question-text keys (from the caller's set) that
 * already exist in the questions table, plus a small map of key -> {id, category}
 * so the UI can show which row they collide with.
 */
export const checkDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ keys: z.array(z.string().min(1).max(500)).min(1).max(5000) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const wanted = new Set(data.keys);
    const { data: rows, error } = await supabaseAdmin
      .from("questions")
      .select("id, category, question_text");
    if (error) throw new Error(error.message);
    const hits: string[] = [];
    const sample: Record<string, { id: string; category: string }> = {};
    for (const r of rows ?? []) {
      const k = dedupeKey(r.question_text);
      if (wanted.has(k) && !sample[k]) {
        sample[k] = { id: r.id, category: r.category };
        hits.push(k);
      }
    }
    return { duplicates: hits, sample };
  });

/**
 * AI question generator via Lovable AI Gateway (tool-calling JSON).
 */
export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      prompt: z.string().min(3).max(500),
      category: z.string().min(1).max(60),
      count: z.number().int().min(1).max(50),
      isPremium: z.boolean().default(false),
      difficulty: z.enum(["easy", "medium", "hard", "impossible", "mixed"]).default("mixed"),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write trivia questions for a live multiplayer game. Each question has exactly one correct answer and three plausible wrong answers. Keep wording crisp and unambiguous. Avoid duplicates. For each question, also include a 1-2 sentence 'explanation' — a fun, conversational fact about WHY the correct answer is right (something a host would read aloud after the reveal), under 200 characters. Also tag each question with a 'difficulty' of easy, medium, hard, or impossible. Calibration: easy = most adults know it; medium = casual fans know it; hard = real fans / trivia regulars; impossible = stumps almost everyone, super obscure detail. The final round of the game uses hard/impossible questions, so when asked to generate at those levels, make them genuinely tough — obscure details, deep cuts, B-sides, not the obvious answer.",
          },
          {
            role: "user",
            content: `Generate ${data.count} trivia questions for the "${data.category}" category. Difficulty target: ${data.difficulty}${data.difficulty === "mixed" ? " (vary across easy/medium/hard/impossible)" : " (every question must be this level)"}. User brief: ${data.prompt}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_questions",
              description: "Return the trivia questions.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: { type: "string" },
                        correct_answer: { type: "string" },
                        wrong_1: { type: "string" },
                        wrong_2: { type: "string" },
                        wrong_3: { type: "string" },
                        explanation: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard", "impossible"] },
                      },
                      required: [
                        "question_text",
                        "correct_answer",
                        "wrong_1",
                        "wrong_2",
                        "wrong_3",
                        "explanation",
                        "difficulty",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_questions" } },
        max_completion_tokens: 8192,
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402) throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const json = await res.json();
    const finishReason = json?.choices?.[0]?.finish_reason;
    const args =
      json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      if (finishReason === "length") {
        throw new Error("AI output was cut off — try a smaller count or a shorter prompt.");
      }
      throw new Error("AI did not return structured output — try rephrasing the prompt or lowering the count.");
    }
    let parsed: {
      questions: Array<{
        question_text: string;
        correct_answer: string;
        wrong_1: string;
        wrong_2: string;
        wrong_3: string;
        explanation?: string;
        difficulty?: "easy" | "medium" | "hard" | "impossible";
      }>;
    };
    try {
      parsed = JSON.parse(args);
    } catch {
      throw new Error("AI output was cut off mid-JSON — try a smaller count or shorter prompt.");
    }
    const fallbackDifficulty =
      data.difficulty === "mixed" ? "medium" : data.difficulty;
    const all = parsed.questions.map((q) => sanitizeQuestion({
      ...q,
      difficulty: q.difficulty ?? fallbackDifficulty,
      category: data.category,
      is_premium: data.isPremium,
    }));
    const distinct = all.filter(answersAreDistinct);
    const skipped = all.length - distinct.length;

    // Semantic-duplicate filtering (within batch + against existing DB rows).
    const tagged = distinct.map((q, i) => ({ ...q, __tmpId: `new-${i}` }));
    const buckets = new Map<string, typeof tagged>();
    for (const q of tagged) {
      const key = normalizeAnswer(q.correct_answer);
      if (!key) continue;
      const arr = buckets.get(key) ?? [];
      arr.push(q);
      buckets.set(key, arr);
    }

    // Fetch existing questions in this category once and index by answer key.
    const { data: existingRows } = await supabaseAdmin
      .from("questions")
      .select("id, question_text, correct_answer")
      .eq("category", data.category);
    const existingByAns = new Map<string, Array<{ id: string; question_text: string }>>();
    for (const r of existingRows ?? []) {
      const k = normalizeAnswer(r.correct_answer);
      if (!k) continue;
      const arr = existingByAns.get(k) ?? [];
      arr.push({ id: r.id, question_text: r.question_text });
      existingByAns.set(k, arr);
    }

    const skipIds = new Set<string>();
    let skippedSemanticDupes = 0;
    for (const [ansKey, newRows] of buckets) {
      const sameAnsExisting = existingByAns.get(ansKey) ?? [];
      const pool = [
        ...newRows.map((r) => ({ id: r.__tmpId, question_text: r.question_text })),
        ...sameAnsExisting.map((r) => ({ id: `db-${r.id}`, question_text: r.question_text })),
      ];
      if (pool.length < 2) continue;
      try {
        const groups = await semanticGroupsForBucket(apiKey, pool);
        for (const group of groups) {
          // Keep the first DB row if any (preserve existing); else keep first new.
          const hasDb = group.some((id: string) => id.startsWith("db-"));
          let keptOne = hasDb;
          for (const id of group) {
            if (id.startsWith("db-")) continue;
            if (!keptOne) {
              keptOne = true;
              continue;
            }
            skipIds.add(id);
            skippedSemanticDupes++;
          }
        }
      } catch {
        // If the AI semantic check fails, do not block insert — fall through.
      }
    }


    const questions = tagged
      .filter((q) => !skipIds.has(q.__tmpId))
      .map(({ __tmpId: _t, ...rest }) => rest);

    return { questions, skipped, skippedSemanticDupes };
  });

/**
 * Backfill the "Did you know?" explanation for existing questions that
 * don't have one. Processes a small batch per call so the UI can loop
 * and show progress. Idempotent — only touches rows where
 * explanation IS NULL OR explanation = ''.
 */
export const backfillExplanations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ batchSize: z.number().int().min(1).max(25).default(15) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { count: remainingBefore } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .or("explanation.is.null,explanation.eq.");

    const { data: rows, error } = await supabaseAdmin
      .from("questions")
      .select("id, category, question_text, correct_answer")
      .or("explanation.is.null,explanation.eq.")
      .limit(data.batchSize);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      return { processed: 0, updated: 0, remaining: 0, done: true };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write a single 'Did you know?' fun fact for trivia questions. Given a question and its correct answer, return a conversational 1-2 sentence fact (under 200 characters) about WHY the answer is right — something a host would read aloud after the reveal. No preamble, just the fact.",
          },
          {
            role: "user",
            content: `Write a fun-fact explanation for each of these questions. Return them in the SAME order.\n\n${rows
              .map(
                (r, i) =>
                  `${i + 1}. [${r.category}] Q: ${r.question_text}\n   A: ${r.correct_answer}`,
              )
              .join("\n\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_explanations",
              description: "Return one explanation per input question, in order.",
              parameters: {
                type: "object",
                properties: {
                  explanations: {
                    type: "array",
                    items: { type: "string" },
                    minItems: rows.length,
                    maxItems: rows.length,
                  },
                },
                required: ["explanations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_explanations" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402)
      throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const json = await res.json();
    const args =
      json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return structured output");
    const parsed = JSON.parse(args) as { explanations: string[] };
    const explanations = parsed.explanations ?? [];

    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const text = (explanations[i] ?? "").toString().trim().slice(0, 500);
      if (!text) continue;
      const { error: upErr } = await supabaseAdmin
        .from("questions")
        .update({ explanation: text })
        .eq("id", rows[i].id);
      if (!upErr) updated++;
    }

    const remaining = Math.max(0, (remainingBefore ?? rows.length) - updated);
    return {
      processed: rows.length,
      updated,
      remaining,
      done: remaining === 0,
    };
  });

/**
 * Count of questions still missing the "Did you know?" explanation.
 */
export const countMissingExplanations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count, error } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .or("explanation.is.null,explanation.eq.");
    if (error) throw new Error(error.message);
    return { missing: count ?? 0 };
  });

/**
 * Count of questions with duplicate answer options (case-insensitive).
 * Scans all rows because PostgREST can't compare two columns directly.
 */
export const countDuplicateAnswers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("questions")
      .select("id, correct_answer, wrong_1, wrong_2, wrong_3");
    if (error) throw new Error(error.message);
    const bad = (data ?? []).filter((q) => !answersAreDistinct(q));
    return { duplicates: bad.length };
  });

/**
 * Repair questions where one of the wrong answers duplicates the correct
 * answer (or another wrong). Sends the bad rows to the Lovable AI gateway
 * asking it to rewrite ONLY the three wrong answers so all four are
 * plausible and distinct. Question, correct answer, category, difficulty,
 * and explanation are preserved.
 */
export const repairDuplicateAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ batchSize: z.number().int().min(1).max(15).default(10) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: all, error } = await supabaseAdmin
      .from("questions")
      .select("id, category, question_text, correct_answer, wrong_1, wrong_2, wrong_3");
    if (error) throw new Error(error.message);
    const bad = (all ?? []).filter((q) => !answersAreDistinct(q));
    if (bad.length === 0) {
      return { processed: 0, updated: 0, remaining: 0, done: true };
    }
    const batch = bad.slice(0, data.batchSize);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You repair trivia questions whose wrong answers accidentally duplicate the correct answer or each other. Given the question and correct answer, write THREE plausible wrong answers that are all distinct from the correct answer and from each other (case-insensitive). Keep wrongs the same category/type as the correct answer (year vs year, name vs name, etc.). Crisp and unambiguous.",
          },
          {
            role: "user",
            content: `Rewrite the three wrong answers for each of these questions. Return them in the SAME order.\n\n${batch
              .map(
                (r, i) =>
                  `${i + 1}. [${r.category}] Q: ${r.question_text}\n   Correct: ${r.correct_answer}`,
              )
              .join("\n\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_wrongs",
              description: "Return three new wrong answers per input question, in order.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    minItems: batch.length,
                    maxItems: batch.length,
                    items: {
                      type: "object",
                      properties: {
                        wrong_1: { type: "string" },
                        wrong_2: { type: "string" },
                        wrong_3: { type: "string" },
                      },
                      required: ["wrong_1", "wrong_2", "wrong_3"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_wrongs" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402)
      throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const json = await res.json();
    const args =
      json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return structured output");
    const parsed = JSON.parse(args) as {
      items: Array<{ wrong_1: string; wrong_2: string; wrong_3: string }>;
    };

    let updated = 0;
    for (let i = 0; i < batch.length; i++) {
      const item = parsed.items?.[i];
      if (!item) continue;
      const candidate = {
        correct_answer: batch[i].correct_answer,
        wrong_1: sanitizeAnswer((item.wrong_1 ?? "")).slice(0, 200),
        wrong_2: sanitizeAnswer((item.wrong_2 ?? "")).slice(0, 200),
        wrong_3: sanitizeAnswer((item.wrong_3 ?? "")).slice(0, 200),
      };

      if (!candidate.wrong_1 || !candidate.wrong_2 || !candidate.wrong_3) continue;
      if (!answersAreDistinct(candidate)) continue;
      const { error: upErr } = await supabaseAdmin
        .from("questions")
        .update({
          wrong_1: candidate.wrong_1,
          wrong_2: candidate.wrong_2,
          wrong_3: candidate.wrong_3,
        })
        .eq("id", batch[i].id);
      if (!upErr) updated++;
    }

    const remaining = Math.max(0, bad.length - updated);
    return {
      processed: batch.length,
      updated,
      remaining,
      done: remaining === 0,
    };
  });

/**
 * Generate an image for a question via Lovable AI (gpt-image-2) and upload it
 * to the private `question-media` bucket. Returns the storage path (stored in
 * `questions.media_url`) and a short-lived signed URL for admin preview.
 */
export const generateQuestionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      prompt: z.string().min(3).max(500),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt: data.prompt,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402) throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Image generation failed (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation returned no data");

    const bytes = Buffer.from(b64, "base64");
    const path = `images/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("question-media")
      .createSignedUrl(path, 60 * 60);
    if (signErr) throw new Error(signErr.message);

    return { path, signedUrl: signed.signedUrl };
  });

/**
 * Mint a short-lived signed URL for a stored question-media object so the
 * admin UI can preview existing image/audio without making the bucket public.
 */
export const signQuestionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ path: z.string().min(1).max(500) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("question-media")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { signedUrl: signed.signedUrl };
  });

/**
 * Generate a voice clip via ElevenLabs TTS and upload it to the private
 * `question-media` bucket. Returns the storage path + signed preview URL.
 */
export const generateQuestionVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      text: z.string().min(1).max(500),
      voiceId: z.string().min(1).max(64),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ElevenLabs is not connected to this project");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Voice generation failed (${res.status}): ${t.slice(0, 200)}`);
    }

    const audioBuffer = await res.arrayBuffer();
    const bytes = Buffer.from(audioBuffer);
    const path = `audio/${crypto.randomUUID()}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: false });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("question-media")
      .createSignedUrl(path, 60 * 60);
    if (signErr) throw new Error(signErr.message);

    return { path, signedUrl: signed.signedUrl };
  });

/**
 * Ask Lovable AI which question IDs in a same-answer bucket are semantic
 * duplicates of one another. Returns array of groups; each inner array is
 * a set of IDs that all ask the same thing (singletons omitted).
 */
async function semanticGroupsForBucket(
  apiKey: string,
  items: Array<{ id: string; question_text: string }>,
): Promise<string[][]> {
  if (items.length < 2) return [];
  const chunks: Array<Array<{ id: string; question_text: string }>> = [];
  for (let i = 0; i < items.length; i += 12) chunks.push(items.slice(i, i + 12));
  const out: string[][] = [];
  for (const chunk of chunks) {
    if (chunk.length < 2) continue;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify trivia questions that ask the SAME thing, just worded differently. Two questions are duplicates ONLY if a player who knows the answer to one would answer the other identically by reasoning about the same fact. Different angles on the same answer (e.g. 'capital of France?' vs 'where is the Eiffel Tower?') are NOT duplicates. Group together IDs of duplicate questions. Omit singletons.",
          },
          {
            role: "user",
            content: `All of these share the same correct answer. Group the IDs that ask the SAME thing:\n\n${chunk
              .map((it) => `- id=${it.id}: ${it.question_text}`)
              .join("\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_groups",
              description: "Return groups of duplicate question IDs.",
              parameters: {
                type: "object",
                properties: {
                  groups: {
                    type: "array",
                    items: { type: "array", items: { type: "string" } },
                  },
                },
                required: ["groups"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_groups" } },
      }),
    });
    if (!res.ok) continue;
    const json = await res.json();
    const args =
      json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) continue;
    try {
      const parsed = JSON.parse(args) as { groups?: string[][] };
      const valid = new Set(chunk.map((c) => c.id));
      for (const g of parsed.groups ?? []) {
        const filtered = (g ?? []).filter((id) => valid.has(id));
        if (filtered.length >= 2) out.push(filtered);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Scan questions for semantic duplicates (same answer, different wording).
 * Buckets by (category, normalized correct_answer), then asks AI which
 * questions in each multi-row bucket actually ask the same thing.
 */
export const findSemanticDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      category: z.string().min(1).max(60).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    let q = supabaseAdmin
      .from("questions")
      .select("id, category, question_text, correct_answer");
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const buckets = new Map<
      string,
      { category: string; correct_answer: string; items: Array<{ id: string; question_text: string }> }
    >();
    for (const r of rows ?? []) {
      const ansKey = normalizeAnswer(r.correct_answer);
      if (!ansKey) continue;
      const key = `${r.category}::${ansKey}`;
      const b =
        buckets.get(key) ??
        { category: r.category, correct_answer: r.correct_answer, items: [] };
      b.items.push({ id: r.id, question_text: r.question_text });
      buckets.set(key, b);
    }

    const candidates = Array.from(buckets.values()).filter((b) => b.items.length >= 2);
    const groups: Array<{
      category: string;
      correct_answer: string;
      items: Array<{ id: string; question_text: string }>;
    }> = [];

    for (const bucket of candidates) {
      const equivGroups = await semanticGroupsForBucket(apiKey, bucket.items);
      const byId = new Map(bucket.items.map((it) => [it.id, it]));
      for (const grp of equivGroups) {
        const items = grp.map((id) => byId.get(id)).filter(Boolean) as Array<{
          id: string;
          question_text: string;
        }>;
        if (items.length >= 2) {
          groups.push({
            category: bucket.category,
            correct_answer: bucket.correct_answer,
            items,
          });
        }
      }
    }

    return {
      scanned: (rows ?? []).length,
      bucketsChecked: candidates.length,
      groups,
    };
  });

/**
 * Bulk-delete questions by id (admin only).
 */
export const deleteQuestionsByIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("questions")
      .delete()
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });

/**
 * Ensure a category_meta row exists for the given category name. If it
 * doesn't, asks Lovable AI to pick a representative single emoji and inserts
 * the row. Returns the resulting row (existing or freshly created).
 *
 * Used by the Gemini paste-in importer to auto-register any unknown category
 * encountered in the pasted JSON, so emoji/defaults flow through the rest of
 * the app without a manual code edit.
 */
export const ensureCategoryMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ name: z.string().min(1).max(60) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const name = data.name.trim();
    if (!name) throw new Error("Empty category name");

    const existing = await supabaseAdmin
      .from("category_meta")
      .select("name, emoji, off_by_default")
      .eq("name", name)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return { meta: existing.data, created: false };

    // Ask Lovable AI for one emoji that represents the category.
    let emoji = "❓";
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You pick a single emoji that best represents a trivia category. Reply with ONLY the emoji — no words, no punctuation, no quotes, no spaces. Exactly one emoji.",
              },
              { role: "user", content: `Trivia category: ${name}` },
            ],
            max_completion_tokens: 16,
          }),
        });
        if (res.ok) {
          const json: any = await res.json();
          const raw: string = json?.choices?.[0]?.message?.content ?? "";
          // Grab the first emoji-like glyph (extended pictographic or symbol).
          const match = raw.match(/\p{Extended_Pictographic}/u);
          if (match) emoji = match[0];
        }
      } catch {
        // fall through to default ❓
      }
    }

    const inserted = await supabaseAdmin
      .from("category_meta")
      .insert({ name, emoji, off_by_default: false })
      .select("name, emoji, off_by_default")
      .single();
    if (inserted.error) {
      // Race: another caller inserted concurrently — fetch the winning row.
      const refetch = await supabaseAdmin
        .from("category_meta")
        .select("name, emoji, off_by_default")
        .eq("name", name)
        .maybeSingle();
      if (refetch.data) return { meta: refetch.data, created: false };
      throw new Error(inserted.error.message);
    }
    return { meta: inserted.data, created: true };
  });
