import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    const { data, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { questions: data ?? [] };
  });

const DIFFICULTY = z.enum(["easy", "medium", "hard", "impossible"]);

const QuestionInput = z.object({
  category: z.string().min(1).max(60),
  subcategory: z.string().max(60).optional().nullable(),
  question_text: z.string().min(3).max(500),
  correct_answer: z.string().min(1).max(200),
  wrong_1: z.string().min(1).max(200),
  wrong_2: z.string().min(1).max(200),
  wrong_3: z.string().min(1).max(200),
  explanation: z.string().max(500).optional().nullable(),
  difficulty: DIFFICULTY.default("medium"),
  media_url: z.string().url().max(500).optional().nullable(),
  media_type: z.string().max(20).optional().nullable(),
  is_premium: z.boolean().default(false),
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
    z.object({ rows: z.array(QuestionInput).min(1).max(500) }).parse,
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
        model: "google/gemini-3-flash-preview",
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
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402) throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const json = await res.json();
    const args =
      json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return structured output");
    const parsed = JSON.parse(args) as {
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
    const fallbackDifficulty =
      data.difficulty === "mixed" ? "medium" : data.difficulty;
    return {
      questions: parsed.questions.map((q) => ({
        ...q,
        difficulty: q.difficulty ?? fallbackDifficulty,
        category: data.category,
        is_premium: data.isPremium,
      })),
    };
  });
