import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getTtsSummary,
  getTtsTimeSeries,
  getTtsTopGames,
  getTTSCacheStats,
  getPersonaPackStats,
  getQuestionTTSStats,
  getExplanationTTSStats,
  generatePersonaPack,
  bakeAllQuestionTTS,
  bakeAllExplanationTTS,
} from "@/lib/announcer.functions";

export const Route = createFileRoute("/_authenticated/admin-tts")({
  component: TtsObservabilityPage,
});

type Summary = Awaited<ReturnType<typeof getTtsSummary>>;
type Series = Awaited<ReturnType<typeof getTtsTimeSeries>>;
type TopGames = Awaited<ReturnType<typeof getTtsTopGames>>;
type CacheStats = Awaited<ReturnType<typeof getTTSCacheStats>>;
type PackStats = { total: number; baked: number };

const RANGES: Array<{ key: "24h" | "7d" | "14d" | "30d"; label: string; days: number }> = [
  { key: "24h", label: "Last 24h", days: 1 },
  { key: "7d", label: "Last 7d", days: 7 },
  { key: "14d", label: "Last 14d", days: 14 },
  { key: "30d", label: "Last 30d", days: 30 },
];

function fmtInt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n));
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtUsd(n: number) {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function TtsObservabilityPage() {
  const summaryFn = useServerFn(getTtsSummary);
  const seriesFn = useServerFn(getTtsTimeSeries);
  const topGamesFn = useServerFn(getTtsTopGames);
  const cacheStatsFn = useServerFn(getTTSCacheStats);
  const personaStatsFn = useServerFn(getPersonaPackStats);
  const questionStatsFn = useServerFn(getQuestionTTSStats);
  const explanationStatsFn = useServerFn(getExplanationTTSStats);

  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("7d");
  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 7;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [topGames, setTopGames] = useState<TopGames | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [personaPack, setPersonaPack] = useState<PackStats | null>(null);
  const [questionPack, setQuestionPack] = useState<PackStats | null>(null);
  const [explanationPack, setExplanationPack] = useState<PackStats | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const seriesDays = Math.max(days, 14);
      const [s, ts, tg, c, pp, qp, ep] = await Promise.all([
        summaryFn({ data: { days } }),
        seriesFn({ data: { days: seriesDays } }),
        topGamesFn({ data: { days, limit: 20 } }),
        cacheStatsFn(),
        personaStatsFn(),
        questionStatsFn(),
        explanationStatsFn(),
      ]);
      setSummary(s);
      setSeries(ts);
      setTopGames(tg);
      setCache(c);
      setPersonaPack(pp);
      setQuestionPack(qp);
      setExplanationPack(ep);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [summaryFn, seriesFn, topGamesFn, cacheStatsFn, personaStatsFn, questionStatsFn, explanationStatsFn, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Admin
            </div>
            <h1 className="mt-1 text-4xl font-bold">Voice cost observability</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Verify the cost insurance is working. Cache hits, cap skips, and
              per-game ElevenLabs spend.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin-sounds"
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
            >
              ← Soundboard
            </Link>
          </div>
        </header>

        {/* Range selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                rangeKey === r.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-card/60"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && !summary ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-10">
            <PreBakePanel
              persona={personaPack}
              question={questionPack}
              explanation={explanationPack}
              onChange={reload}
            />
            <AlertsBanner summary={summary} topGames={topGames} days={days} />
            <SummaryCards summary={summary} />
            <TrendChart series={series} />
            <TopGamesTable data={topGames} />
            <TopCachedLines cache={cache} />
          </div>
        )}
      </div>
    </div>
  );
}

// Thresholds — tuned for typical use. Tweak here.
const ALERT_THRESHOLDS = {
  minCallsForHitRate: 50,
  lowHitRate: 0.6, // below 60%
  highErrorRate: 0.05, // above 5%
  dailyUsdBudget: 1.0, // per-day estimated spend
  maxGamesAtCap: 2, // more than 2 games at cap
};

type Alert = {
  level: "warn" | "danger";
  title: string;
  detail: string;
};

function computeAlerts(
  summary: Summary | null,
  topGames: TopGames | null,
  days: number,
): Alert[] {
  const out: Alert[] = [];
  if (!summary) return out;
  // Low cache hit rate
  if (
    summary.total >= ALERT_THRESHOLDS.minCallsForHitRate &&
    summary.cacheHitRate < ALERT_THRESHOLDS.lowHitRate
  ) {
    out.push({
      level: "warn",
      title: "Low cache hit rate",
      detail: `${fmtPct(summary.cacheHitRate)} (target ≥ ${fmtPct(ALERT_THRESHOLDS.lowHitRate)}). Review dynamic line patterns — cache key may be too unique.`,
    });
  }
  // Error rate
  const errorRate = summary.total > 0 ? summary.errors / summary.total : 0;
  if (errorRate > ALERT_THRESHOLDS.highErrorRate) {
    out.push({
      level: "danger",
      title: "Elevated TTS error rate",
      detail: `${fmtPct(errorRate)} of calls errored (${fmtInt(summary.errors)} fails). Check ElevenLabs status & API key.`,
    });
  }
  // Spend pace
  const perDay = summary.estCostUsd / Math.max(1, days);
  if (perDay > ALERT_THRESHOLDS.dailyUsdBudget) {
    out.push({
      level: "warn",
      title: "Spend pace above budget",
      detail: `${fmtUsd(perDay)}/day avg (budget ${fmtUsd(ALERT_THRESHOLDS.dailyUsdBudget)}). ${fmtUsd(summary.estCostUsd)} total in last ${days}d.`,
    });
  }
  // Games at cap
  if (topGames) {
    const atCap = topGames.rows.filter((r) => r.total >= topGames.cap).length;
    if (atCap > ALERT_THRESHOLDS.maxGamesAtCap) {
      out.push({
        level: "danger",
        title: "Multiple games hit the cap",
        detail: `${atCap} games maxed the ${topGames.cap}-call/game cap. Cost insurance is firing — investigate dynamic line spam.`,
      });
    }
  }
  return out;
}

function AlertsBanner({
  summary,
  topGames,
  days,
}: {
  summary: Summary | null;
  topGames: TopGames | null;
  days: number;
}) {
  const alerts = computeAlerts(summary, topGames, days);
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
          ✓
        </span>
        <div>
          <div className="font-bold text-emerald-200">All clear</div>
          <div className="text-xs text-emerald-200/70">
            Cache, spend, and error rate are within thresholds for the last {days}d.
          </div>
        </div>
      </div>
    );
  }
  return (
    <section className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.title}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
            a.level === "danger"
              ? "border-rose-400/50 bg-rose-500/10"
              : "border-amber-400/50 bg-amber-500/10"
          }`}
        >
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${
              a.level === "danger"
                ? "bg-rose-500/25 text-rose-200"
                : "bg-amber-500/25 text-amber-200"
            }`}
          >
            {a.level === "danger" ? "!" : "⚠"}
          </span>
          <div>
            <div
              className={`font-bold ${
                a.level === "danger" ? "text-rose-100" : "text-amber-100"
              }`}
            >
              {a.title}
            </div>
            <div
              className={`text-xs ${
                a.level === "danger" ? "text-rose-200/80" : "text-amber-200/80"
              }`}
            >
              {a.detail}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function SummaryCards({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  const cards: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: "Total calls",
      value: fmtInt(summary.total),
      sub: `${fmtInt(summary.uniqueGames)} games · avg ${summary.avgCallsPerGame.toFixed(1)}/game`,
    },
    {
      label: "Cache hit rate",
      value: fmtPct(summary.cacheHitRate),
      sub: `${fmtInt(summary.cacheHits)} hits / ${fmtInt(summary.generated)} generated`,
    },
    {
      label: "Cap skips",
      value: fmtInt(summary.capSkipped),
      sub: summary.capSkipRate > 0 ? `${fmtPct(summary.capSkipRate)} of calls` : "no skips",
    },
    {
      label: "Estimated spend",
      value: fmtUsd(summary.estCostUsd),
      sub: `${fmtInt(summary.generatedChars)} chars · $${summary.costPerMillion}/1M`,
    },
  ];
  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-2 font-display text-3xl font-black">{c.value}</div>
            {c.sub && (
              <div className="mt-1 text-xs text-muted-foreground">{c.sub}</div>
            )}
          </div>
        ))}
      </div>
      {summary.errors > 0 && (
        <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-2 text-sm">
          ⚠ {fmtInt(summary.errors)} errored calls in this window.
        </div>
      )}
    </section>
  );
}

function TrendChart({ series }: { series: Series | null }) {
  if (!series) return null;
  const max = Math.max(
    1,
    ...series.buckets.map(
      (b) => b.cache_hits + b.generated + b.cap_skipped + b.errors,
    ),
  );
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">Daily trend ({series.days}d)</h2>
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <div className="flex items-end gap-1" style={{ height: 180 }}>
          {series.buckets.map((b) => {
            const total = b.cache_hits + b.generated + b.cap_skipped + b.errors;
            const h = (total / max) * 100;
            return (
              <div
                key={b.day}
                className="group flex flex-1 flex-col items-center justify-end"
                title={`${b.day} · ${total} calls · ${b.cache_hits} cached · ${b.generated} gen · ${b.cap_skipped} skipped`}
              >
                <div
                  className="w-full overflow-hidden rounded-t-sm bg-muted/30"
                  style={{ height: `${h}%`, minHeight: total > 0 ? 2 : 0 }}
                >
                  {total > 0 && (
                    <div className="flex h-full w-full flex-col">
                      <div
                        className="bg-rose-500/80"
                        style={{ flex: b.cap_skipped }}
                        aria-label="cap skipped"
                      />
                      <div
                        className="bg-amber-500/80"
                        style={{ flex: b.errors }}
                        aria-label="errors"
                      />
                      <div
                        className="bg-orange-400/90"
                        style={{ flex: b.generated }}
                        aria-label="generated"
                      />
                      <div
                        className="bg-emerald-400/90"
                        style={{ flex: b.cache_hits }}
                        aria-label="cache hits"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <LegendDot color="bg-emerald-400/90" label="Cache hit" />
          <LegendDot color="bg-orange-400/90" label="Generated" />
          <LegendDot color="bg-rose-500/80" label="Cap skipped" />
          <LegendDot color="bg-amber-500/80" label="Error" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{series.buckets[0]?.day ?? ""}</span>
          <span>{series.buckets[series.buckets.length - 1]?.day ?? ""}</span>
        </div>
      </div>
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function TopGamesTable({ data }: { data: TopGames | null }) {
  if (!data) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">
        Top games by spend ({data.days}d)
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Room</th>
              <th className="px-4 py-2 text-right">Calls</th>
              <th className="px-4 py-2 text-right">Cached</th>
              <th className="px-4 py-2 text-right">Generated</th>
              <th className="px-4 py-2 text-right">Skipped</th>
              <th className="px-4 py-2 text-right">Chars</th>
              <th className="px-4 py-2 text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No games in this window yet.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => {
                const atCap = r.total >= data.cap;
                return (
                  <tr key={r.room_id} className="border-t border-border/50">
                    <td className="px-4 py-2 font-mono">
                      {r.room_code}
                      {atCap && (
                        <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          at cap
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {r.total}
                      <span className="text-muted-foreground">/{data.cap}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-400">
                      {r.cache_hits}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-orange-300">
                      {r.generated}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-rose-300">
                      {r.cap_skipped}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {fmtInt(r.generated_chars)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {fmtUsd(r.est_cost_usd)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TopCachedLines({ cache }: { cache: CacheStats | null }) {
  if (!cache) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">Top cached lines</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border/50 px-4 py-2 text-xs text-muted-foreground">
          {fmtInt(cache.total)} cached lines · {fmtInt(cache.totalHits)} free replays served · cap {cache.cap}/game
        </div>
        <ul className="divide-y divide-border/50">
          {cache.top.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Cache is empty.
            </li>
          ) : (
            cache.top.map((row, i) => (
              <li key={`${row.preset}-${i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(row.hit_count).padStart(3, " ")}×
                </span>
                <span className="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                  {row.preset}
                </span>
                <span className="flex-1 truncate">{row.text}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
