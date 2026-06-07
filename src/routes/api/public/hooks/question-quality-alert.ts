import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Daily cron — finds questions with poor stats and pings Slack.
// Requires SLACK_WEBHOOK_URL env. Triggered via pg_cron with apikey header.
export const Route = createFileRoute("/api/public/hooks/question-quality-alert")({
  server: {
    handlers: {
      POST: async () => {
        const webhook = process.env.SLACK_WEBHOOK_URL;
        if (!webhook) {
          return new Response(
            JSON.stringify({ skipped: true, reason: "SLACK_WEBHOOK_URL not configured" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const { data, error } = await supabaseAdmin
          .from("questions")
          .select(
            "id, category, question_text, correct_answer, times_answered, times_correct",
          )
          .gte("times_answered", 10);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const bad = (data ?? [])
          .map((q) => {
            const a = (q as { times_answered?: number }).times_answered ?? 0;
            const c = (q as { times_correct?: number }).times_correct ?? 0;
            return { ...q, plays: a, correct: c, rate: a > 0 ? c / a : 0 };
          })
          .filter((q) => q.rate < 0.2)
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 10);

        if (bad.length === 0) {
          return new Response(JSON.stringify({ sent: false, found: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const text =
          `🚨 *Low-quality questions detected* (≥10 plays, <20% correct)\n` +
          bad
            .map(
              (q, i) =>
                `${i + 1}. [${q.category}] _${(q.question_text as string).slice(0, 120)}_ — ${q.correct} / ${q.plays} correct (${Math.round(
                  q.rate * 100,
                )}%) · answer: *${q.correct_answer}*`,
            )
            .join("\n");

        const slackRes = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        return new Response(
          JSON.stringify({ sent: slackRes.ok, found: bad.length, status: slackRes.status }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
