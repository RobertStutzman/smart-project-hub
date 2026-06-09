import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCapacityHealth } from "@/lib/health.functions";

// Estimated ceilings for current Lovable Cloud tier. Bump after load testing.
const MAX_LOBBIES = 200;
const MAX_PLAYERS = 1600;

type Status = "green" | "yellow" | "red";

function statusOf(value: number, ceiling: number): Status {
  const pct = value / ceiling;
  if (pct >= 0.7) return "red";
  if (pct >= 0.4) return "yellow";
  return "green";
}

const STATUS_META: Record<Status, { dot: string; label: string; bar: string; ring: string }> = {
  green: {
    dot: "bg-emerald-400",
    label: "Healthy",
    bar: "bg-emerald-400",
    ring: "ring-emerald-400/30",
  },
  yellow: {
    dot: "bg-amber-400",
    label: "Plan upgrade",
    bar: "bg-amber-400",
    ring: "ring-amber-400/30",
  },
  red: {
    dot: "bg-rose-500",
    label: "Upgrade now",
    bar: "bg-rose-500",
    ring: "ring-rose-400/30",
  },
};

function Metric({
  label,
  value,
  ceiling,
  suffix,
}: {
  label: string;
  value: number;
  ceiling: number;
  suffix?: string;
}) {
  const status = statusOf(value, ceiling);
  const meta = STATUS_META[status];
  const pct = Math.min(100, Math.round((value / ceiling) * 100));
  return (
    <div className={`rounded-2xl border border-border bg-card/40 p-4 ring-1 ${meta.ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">
          / {ceiling.toLocaleString()} {suffix ?? ""} ({pct}%)
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${meta.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CapacityWidget() {
  const fetchHealth = useServerFn(getCapacityHealth);
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin", "capacity-health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 30_000,
  });

  return (
    <section className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">📊 Capacity health</h2>
          <p className="text-xs text-muted-foreground">
            Live snapshot · refreshes every 30s · 🟢 &lt;40% · 🟡 40–70% · 🔴 70%+
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-card/60 disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading capacity…</div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          Failed to load: {(error as Error).message}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Active lobbies" value={data.activeLobbies} ceiling={MAX_LOBBIES} />
          <Metric label="Live players" value={data.livePlayers} ceiling={MAX_PLAYERS} />
          <Metric
            label="Questions in DB"
            value={data.totalQuestions}
            ceiling={50_000}
            suffix="rows"
          />
        </div>
      ) : null}
    </section>
  );
}
