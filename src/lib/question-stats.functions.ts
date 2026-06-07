import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin access required");
}

export type QuestionStatRow = {
  id: string;
  category: string;
  question_text: string;
  correct_answer: string;
  difficulty: string;
  times_answered: number;
  times_correct: number;
  total_response_ms: number;
  times_used: number;
  correct_rate: number; // 0..1
  avg_response_ms: number;
};

export const listQuestionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("questions")
      .select(
        "id, category, question_text, correct_answer, difficulty, times_answered, times_correct, total_response_ms, times_used",
      )
      .order("times_answered", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows: QuestionStatRow[] = (data ?? []).map((q) => {
      const a = (q as { times_answered?: number }).times_answered ?? 0;
      const c = (q as { times_correct?: number }).times_correct ?? 0;
      const t = (q as { total_response_ms?: number }).total_response_ms ?? 0;
      return {
        id: q.id as string,
        category: q.category as string,
        question_text: q.question_text as string,
        correct_answer: q.correct_answer as string,
        difficulty: (q.difficulty as string) ?? "medium",
        times_answered: a,
        times_correct: c,
        total_response_ms: t,
        times_used: (q as { times_used?: number }).times_used ?? 0,
        correct_rate: a > 0 ? c / a : 0,
        avg_response_ms: a > 0 ? Math.round(t / a) : 0,
      };
    });
    return { rows };
  });
