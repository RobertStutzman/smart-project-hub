import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { listQuestionStats, type QuestionStatRow } from "@/lib/question-stats.functions";

export const Route = createFileRoute("/_authenticated/admin-questions")({
  head: () => ({
    meta: [{ title: "Question Quality — Admin" }],
  }),
  component: QuestionStatsPage,
});

type SortKey = "correct_rate" | "times_answered" | "avg_response_ms" | "times_used";

function QuestionStatsPage() {
  const fn = useServerFn(listQuestionStats);
  const [rows, setRows] = useState<QuestionStatRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("correct_rate");
  const [minPlays, setMinPlays] = useState(5);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fn();
        setRows(res.rows);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [fn]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const f = rows
      .filter((r) => r.times_answered >= minPlays)
      .filter((r) =>
        search ? r.question_text.toLowerCase().includes(search.toLowerCase()) : true,
      );
    const sorted = [...f].sort((a, b) => {
      if (sort === "correct_rate") return a.correct_rate - b.correct_rate;
      if (sort === "avg_response_ms") return b.avg_response_ms - a.avg_response_ms;
      return (b[sort] as number) - (a[sort] as number);
    });
    return sorted;
  }, [rows, sort, minPlays, search]);

  const summary = useMemo(() => {
    if (!rows) return null;
    const withData = rows.filter((r) => r.times_answered > 0);
    const totalPlays = withData.reduce((s, r) => s + r.times_answered, 0);
    const totalCorrect = withData.reduce((s, r) => s + r.times_correct, 0);
    return {
      questions: rows.length,
      played: withData.length,
      totalPlays,
      overallRate: totalPlays > 0 ? totalCorrect / totalPlays : 0,
    };
  }, [rows]);

  if (err) {
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-md rounded-3xl border border-border bg-card/60 p-8">
          <h1 className="text-2xl font-bold">{err}</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 lg:p-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</div>
          <h1 className="mt-1 text-4xl font-bold">Question Quality</h1>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin"
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
          >
            ← Library
          </Link>
        </div>
      </header>

      {summary && (
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total questions" value={summary.questions.toLocaleString()} />
          <Stat label="Played at least once" value={summary.played.toLocaleString()} />
          <Stat label="Total plays" value={summary.totalPlays.toLocaleString()} />
          <Stat
            label="Overall correct rate"
            value={`${Math.round(summary.overallRate * 100)}%`}
          />
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          placeholder="Search question text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Min plays
          <input
            type="number"
            min={0}
            value={minPlays}
            onChange={(e) => setMinPlays(Number(e.target.value) || 0)}
            className="w-20 rounded-full border border-border bg-background/60 px-3 py-1 text-sm"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full border border-border bg-background/60 px-3 py-2 text-sm"
        >
          <option value="correct_rate">Sort: lowest correct rate (likely bad questions)</option>
          <option value="times_answered">Sort: most played</option>
          <option value="avg_response_ms">Sort: slowest avg response</option>
          <option value="times_used">Sort: most used in rooms</option>
        </select>
      </div>

      {!rows ? (
        <div className="py-20 text-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Correct</th>
                <th className="px-3 py-2 text-right">Plays</th>
                <th className="px-3 py-2 text-right">% correct</th>
                <th className="px-3 py-2 text-right">Avg time</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const pct = Math.round(r.correct_rate * 100);
                const badge =
                  pct < 20
                    ? "bg-rose-500/15 text-rose-300 ring-rose-400/30"
                    : pct < 40
                      ? "bg-amber-500/15 text-amber-300 ring-amber-400/30"
                      : pct > 90
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : "bg-sky-500/15 text-sky-300 ring-sky-400/30";
                return (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.category}</td>
                    <td className="px-3 py-2 max-w-md">{r.question_text}</td>
                    <td className="px-3 py-2 font-medium">{r.correct_answer}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.times_answered}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${badge}`}
                      >
                        {pct}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {(r.avg_response_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/admin"
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-background/60"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No questions match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
