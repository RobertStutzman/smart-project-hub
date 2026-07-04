import { useCallback, useMemo, useRef, useState } from "react";
import {
  runScenario,
  type RunnerReport,
  type Scenario,
  type Step,
} from "@/lib/round-runner";
import { enableDebugBus } from "@/lib/debug-bus";

type Props = {
  roomCode: string;
  hostIframe: HTMLIFrameElement | null;
  spawnBots: (n: number) => Promise<void>;
  botCount: number;
};

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "full3Round", label: "Full 3-round game" },
  { id: "lightning", label: "Lightning round focus" },
  { id: "finalOnly", label: "Final round only" },
  { id: "lobbyStress", label: "Lobby stress (×3)" },
  { id: "audienceHandoff", label: "Audience noise handoff" },
];

type BatchCell = { runs: number; passes: number; fails: number; failedSteps: string[] };
type BatchState = { iterations: number; current?: { scenario: Scenario; iter: number }; results: Record<string, BatchCell> };

export function RunnerPanel({ roomCode, hostIframe, spawnBots, botCount }: Props) {
  const [scenario, setScenario] = useState<Scenario>("full3Round");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<RunnerReport | null>(null);
  const [iterations, setIterations] = useState(3);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendToHost = useCallback(
    (msg: { type: string } & Record<string, unknown>) => {
      hostIframe?.contentWindow?.postMessage(msg, "*");
    },
    [hostIframe],
  );

  const runOne = useCallback(
    async (which: Scenario, signal: AbortSignal) => {
      setSteps([]);
      setReport(null);
      return runScenario({
        scenario: which,
        botCount,
        spawnBots,
        sendToHost,
        onStepsChange: setSteps,
        onDone: setReport,
        abortSignal: signal,
      });
    },
    [botCount, spawnBots, sendToHost],
  );

  const onRun = useCallback(async () => {
    if (running) return;
    enableDebugBus();
    setBatch(null);
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const rep = await runOne(scenario, ac.signal);
      setReport(rep);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [running, scenario, runOne]);

  const onBatch = useCallback(async () => {
    if (running) return;
    enableDebugBus();
    const n = Math.max(1, Math.min(20, iterations));
    const empty: Record<string, BatchCell> = {};
    for (const s of SCENARIOS) empty[s.id] = { runs: 0, passes: 0, fails: 0, failedSteps: [] };
    setBatch({ iterations: n, results: empty });
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      for (let i = 1; i <= n; i++) {
        for (const s of SCENARIOS) {
          if (ac.signal.aborted) break;
          setBatch((prev) => prev && { ...prev, current: { scenario: s.id, iter: i } });
          const rep = await runOne(s.id, ac.signal);
          setBatch((prev) => {
            if (!prev) return prev;
            const cell = { ...prev.results[s.id] };
            cell.runs += 1;
            if (rep.passed) cell.passes += 1;
            else {
              cell.fails += 1;
              for (const st of rep.steps) if (st.status === "fail") cell.failedSteps.push(st.label);
            }
            return { ...prev, results: { ...prev.results, [s.id]: cell } };
          });
        }
        if (ac.signal.aborted) break;
      }
    } finally {
      setBatch((prev) => prev && { ...prev, current: undefined });
      setRunning(false);
      abortRef.current = null;
    }
  }, [running, iterations, runOne]);

  const onStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const copyReport = useCallback(async () => {
    if (batch) {
      const lines: string[] = [`# QA batch — ${batch.iterations} iterations`];
      for (const s of SCENARIOS) {
        const c = batch.results[s.id];
        lines.push(`- ${s.label}: ${c.passes}/${c.runs} passed${c.fails ? ` · fails: ${[...new Set(c.failedSteps)].join(", ")}` : ""}`);
      }
      try { await navigator.clipboard.writeText(lines.join("\n")); } catch {}
      return;
    }
    const r = report ?? { scenario, passed: false, startedAt: 0, endedAt: 0, steps };
    const lines = [
      `# QA Runner report — ${r.scenario}`,
      `passed: ${r.passed}`,
      "",
      ...r.steps.map(
        (s) => `[${s.status.padEnd(7)}] ${s.label}${s.detail ? "  — " + s.detail : ""}${s.elapsedMs != null ? `  (${s.elapsedMs}ms)` : ""}`,
      ),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch {}
  }, [batch, report, scenario, steps]);

  const canRun = !!roomCode && !running;

  const summary = useMemo(() => {
    const total = steps.length;
    const pass = steps.filter((s) => s.status === "pass").length;
    const fail = steps.filter((s) => s.status === "fail").length;
    return { total, pass, fail };
  }, [steps]);

  return (
    <aside className="flex w-[360px] flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400">
        Automated round runner
      </div>

      <div className="flex flex-col gap-2 border-b border-zinc-800 p-3 text-xs">
        <label className="flex items-center gap-2">
          <span className="w-16 text-zinc-400">Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
            disabled={running}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none focus:border-zinc-500 disabled:opacity-40"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={!canRun}
            className="flex-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
          >
            {running ? "Running…" : "▶ Run"}
          </button>
          <button
            onClick={onStop}
            disabled={!running}
            className="rounded border border-red-500/60 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            ■ Stop
          </button>
          <button
            onClick={copyReport}
            disabled={steps.length === 0 && !batch}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
          >
            ⧉ Copy
          </button>
        </div>

        <div className="mt-1 flex items-center gap-2 border-t border-zinc-800 pt-2">
          <label className="flex items-center gap-1">
            <span className="text-zinc-400">Iter</span>
            <input
              type="number"
              min={1}
              max={20}
              value={iterations}
              disabled={running}
              onChange={(e) => setIterations(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none focus:border-zinc-500 disabled:opacity-40"
            />
          </label>
          <button
            onClick={onBatch}
            disabled={!canRun}
            className="flex-1 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
          >
            ⚡ Batch run all
          </button>
        </div>

        {report && (
          <div
            className={`mt-1 rounded px-2 py-1 text-center text-[11px] font-semibold ${
              report.passed
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-red-500/15 text-red-300"
            }`}
          >
            {report.passed ? "PASSED" : "FAILED"} — {summary.pass}/{summary.total} steps
            {summary.fail > 0 && ` · ${summary.fail} fail`}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {steps.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            Click Run to drive a full game automatically. Uses the bot count above.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-900">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-2 px-3 py-2 text-[11px]">
                <StepDot status={s.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zinc-100">{s.label}</div>
                  {s.detail && (
                    <div className={`truncate text-[10px] ${s.status === "fail" ? "text-red-300" : "text-zinc-500"}`}>
                      {s.detail}
                    </div>
                  )}
                </div>
                {s.elapsedMs != null && (
                  <span className="font-mono text-[10px] text-zinc-500">{s.elapsedMs}ms</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function StepDot({ status }: { status: Step["status"] }) {
  const cls =
    status === "pass"
      ? "bg-emerald-500"
      : status === "fail"
        ? "bg-red-500"
        : status === "running"
          ? "bg-blue-500 animate-pulse"
          : status === "skipped"
            ? "bg-zinc-600"
            : "bg-zinc-700";
  return <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}
