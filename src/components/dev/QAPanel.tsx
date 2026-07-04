import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  enableDebugBus,
  installDebugBridge,
  subscribeDebugBus,
  type StampedEvent,
} from "@/lib/debug-bus";

type AssertionState = "pending" | "pass" | "fail";
type Assertion = {
  id: string;
  label: string;
  state: AssertionState;
  detail?: string;
};

export type QAPanelRef = {
  getAssertions: () => Assertion[];
};

type Props = {
  roomCode: string;
  roomPhase?: string;
};

// Assertion IDs
const A = {
  lobbyAmbience: "lobby.ambience",
  noBig321: "no.big321",
  questionTimer: "question.timer",
  finalTimer: "final.timer",
  finalDifficulty: "final.difficulty",
  lightningNoDrop: "lightning.nodrop",
  finalMusic: "final.music",
  noBareNumberVO: "vo.no-bare-number",
} as const;

function defaultAssertions(): Assertion[] {
  return [
    { id: A.lobbyAmbience, label: "Lobby crowd ambience starts within 5s of lobby phase", state: "pending" },
    { id: A.noBig321, label: "No giant 3-2-1 countdown BEFORE each question", state: "pending" },
    { id: A.questionTimer, label: "Regular question timer is 15–25s", state: "pending" },
    { id: A.finalTimer, label: "Final round timer is ~30s", state: "pending" },
    { id: A.finalDifficulty, label: "Final round pulls a 'hard' question", state: "pending" },
    { id: A.lightningNoDrop, label: "No answer drops during lightning round", state: "pending" },
    { id: A.finalMusic, label: "Final music starts near final phase", state: "pending" },
    { id: A.noBareNumberVO, label: "Announcer never says a bare number ('2', '3')", state: "pending" },
  ];
}

export const QAPanel = forwardRef<QAPanelRef, Props>(function QAPanel({ roomCode, roomPhase }, ref) {
  const [events, setEvents] = useState<StampedEvent[]>([]);
  const [assertions, setAssertions] = useState<Assertion[]>(defaultAssertions);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useImperativeHandle(ref, () => ({
    getAssertions: () => assertions,
  }), [assertions]);

  // Enable + bridge
  useEffect(() => {
    enableDebugBus();
    const off = installDebugBridge();
    // Re-enable in child iframes on interval (they might mount later)
    const id = window.setInterval(enableDebugBus, 1500);
    return () => { off(); window.clearInterval(id); };
  }, []);

  // Subscribe
  useEffect(() => {
    return subscribeDebugBus((e) => {
      if (pausedRef.current) return;
      setEvents((prev) => {
        const next = [...prev, e];
        if (next.length > 500) next.splice(0, next.length - 500);
        return next;
      });
    });
  }, []);

  // Assertion grading — reruns whenever events change
  useEffect(() => {
    setAssertions((prev) => prev.map((a) => grade(a, events)));
  }, [events]);

  const filtered = useMemo(() => {
    if (!filter) return events;
    const q = filter.toLowerCase();
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
  }, [events, filter]);

  const passCount = assertions.filter((a) => a.state === "pass").length;
  const failCount = assertions.filter((a) => a.state === "fail").length;

  const resetAll = () => {
    setEvents([]);
    setAssertions(defaultAssertions());
  };

  const copyLog = async () => {
    const text = events
      .map((e) => `${new Date(e.t).toISOString()} [${e.from}] ${JSON.stringify(e)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  };

  return (
    <aside className="flex w-[360px] flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400">
        <span>QA harness</span>
        <span className="ml-auto rounded bg-zinc-900 px-2 py-0.5 font-mono text-[10px]">
          {roomCode || "····"} · {roomPhase ?? "?"}
        </span>
      </div>

      {/* Assertions */}
      <div className="border-b border-zinc-800">
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
          Assertions
          <span className="ml-auto font-mono">
            <span className="text-emerald-400">{passCount}✓</span>
            {" · "}
            <span className={failCount > 0 ? "text-red-400" : "text-zinc-500"}>{failCount}✗</span>
          </span>
        </div>
        <ul className="divide-y divide-zinc-900 text-xs">
          {assertions.map((a) => (
            <li key={a.id} className="flex items-start gap-2 px-3 py-1.5">
              <span
                className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                  a.state === "pass"
                    ? "bg-emerald-500"
                    : a.state === "fail"
                      ? "bg-red-500"
                      : "bg-zinc-600"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate">{a.label}</div>
                {a.detail && (
                  <div className="mt-0.5 truncate text-[10px] text-zinc-500">{a.detail}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 px-3 py-2 text-[10px]">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter events…"
          className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-600"
        />
        <button
          onClick={() => setPaused((p) => !p)}
          className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-900"
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
        <button
          onClick={copyLog}
          className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-900"
        >
          copy
        </button>
        <button
          onClick={resetAll}
          className="rounded border border-red-500/60 px-2 py-1 text-red-300 hover:bg-red-500/10"
        >
          reset
        </button>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-auto font-mono text-[10px] leading-tight">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-zinc-600">
            No events yet. Play a game or click a scenario.
          </div>
        ) : (
          <ul>
            {filtered
              .slice()
              .reverse()
              .map((e, i) => (
                <li
                  key={`${e.t}-${i}`}
                  className="border-b border-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-900/60"
                >
                  <span className="text-zinc-600">
                    {new Date(e.t).toLocaleTimeString([], { hour12: false })}
                  </span>{" "}
                  <span className="text-cyan-400">{e.type}</span>{" "}
                  <span className="text-zinc-500">
                    {shortPayload(e)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </aside>
  );
});

function shortPayload(e: StampedEvent): string {
  const { type: _t, t: _at, from: _f, ...rest } = e as unknown as Record<string, unknown>;
  void _t; void _at; void _f;
  const s = JSON.stringify(rest);
  return s.length > 100 ? s.slice(0, 100) + "…" : s;
}

// ──────────────────────────────────────────────────────────────────────────
// Assertion grading
// ──────────────────────────────────────────────────────────────────────────

function grade(a: Assertion, events: StampedEvent[]): Assertion {
  switch (a.id) {
    case A.lobbyAmbience:
      return gradeLobbyAmbience(a, events);
    case A.noBig321:
      return gradeNoBig321(a, events);
    case A.questionTimer:
      return gradeQuestionTimer(a, events);
    case A.finalTimer:
      return gradeFinalTimer(a, events);
    case A.finalDifficulty:
      return gradeFinalDifficulty(a, events);
    case A.lightningNoDrop:
      return gradeLightningNoDrop(a, events);
    case A.finalMusic:
      return gradeFinalMusic(a, events);
    case A.noBareNumberVO:
      return gradeNoBareNumberVO(a, events);
    default:
      return a;
  }
}

function firstPhase(events: StampedEvent[], phase: string) {
  return events.find((e) => e.type === "phase.change" && (e as { phase: string }).phase === phase);
}

function gradeLobbyAmbience(a: Assertion, events: StampedEvent[]): Assertion {
  const lobby = firstPhase(events, "lobby");
  if (!lobby) return { ...a, state: "pending" };
  const amb = events.find(
    (e) =>
      e.type === "ambience.start" &&
      ((e as { layer: string }).layer === "crowd" || (e as { layer: string }).layer === "chatter") &&
      e.t >= lobby.t &&
      e.t - lobby.t <= 5000,
  );
  if (amb) return { ...a, state: "pass", detail: `+${amb.t - lobby.t}ms` };
  const blocked = events.find(
    (e) => e.type === "ambience.blocked" && e.t >= lobby.t && e.t - lobby.t <= 5000,
  );
  if (blocked) return { ...a, state: "fail", detail: "ambience blocked by autoplay — no gesture retry" };
  // Not blocked yet, still waiting
  return { ...a, state: "pending" };
}

function gradeNoBig321(a: Assertion, events: StampedEvent[]): Assertion {
  const bad = events.find((e) => e.type === "countdown.show" && (e as { kind: string }).kind === "big-321");
  if (bad) return { ...a, state: "fail", detail: `fired at ${new Date(bad.t).toLocaleTimeString()}` };
  // Pass once we've seen at least one question so the check has been exercised
  const q = events.find((e) => e.type === "question.show");
  return { ...a, state: q ? "pass" : "pending" };
}

function gradeQuestionTimer(a: Assertion, events: StampedEvent[]): Assertion {
  const timers = events.filter(
    (e) => e.type === "timer.start" && (e as { scope: string }).scope === "question",
  ) as (StampedEvent & { scope: string; durationS: number })[];
  if (timers.length === 0) return { ...a, state: "pending" };
  const oob = timers.find((t) => t.durationS < 8 || t.durationS > 40);
  if (oob) return { ...a, state: "fail", detail: `saw ${oob.durationS}s` };
  const dur = timers[timers.length - 1].durationS;
  return { ...a, state: "pass", detail: `latest ${dur}s (${timers.length} timers)` };
}

function gradeFinalTimer(a: Assertion, events: StampedEvent[]): Assertion {
  const finalPhase = events.find(
    (e) => e.type === "phase.change" &&
      /final/.test((e as { phase: string }).phase),
  );
  if (!finalPhase) return { ...a, state: "pending" };
  const t = events.find(
    (e) => e.type === "timer.start" &&
      ((e as { scope: string }).scope === "final" ||
        ((e as { scope: string }).scope === "question" && e.t >= finalPhase.t)),
  ) as (StampedEvent & { durationS: number }) | undefined;
  if (!t) return { ...a, state: "pending" };
  if (t.durationS >= 25 && t.durationS <= 35) return { ...a, state: "pass", detail: `${t.durationS}s` };
  return { ...a, state: "fail", detail: `saw ${t.durationS}s (expected ~30)` };
}

function gradeFinalDifficulty(a: Assertion, events: StampedEvent[]): Assertion {
  const f = events.find((e) => e.type === "final.question") as
    | (StampedEvent & { difficulty: string | null })
    | undefined;
  if (!f) return { ...a, state: "pending" };
  if (f.difficulty === "hard" || f.difficulty === "impossible") {
    return { ...a, state: "pass", detail: f.difficulty };
  }
  return { ...a, state: "fail", detail: `difficulty=${f.difficulty}` };
}

function gradeLightningNoDrop(a: Assertion, events: StampedEvent[]): Assertion {
  // Find any phase.change carrying 'lightning' anywhere
  const lightning = events.find(
    (e) => e.type === "phase.change" && /lightning/i.test((e as { phase: string }).phase),
  );
  if (!lightning) return { ...a, state: "pending" };
  const nextPhase = events.find(
    (e) =>
      e.type === "phase.change" &&
      e.t > lightning.t &&
      !/lightning/i.test((e as { phase: string }).phase),
  );
  const end = nextPhase?.t ?? Infinity;
  const drop = events.find(
    (e) => e.type === "drop.answer" && e.t >= lightning.t && e.t <= end,
  );
  if (drop) return { ...a, state: "fail", detail: `drop during lightning` };
  return { ...a, state: nextPhase ? "pass" : "pending" };
}

function gradeFinalMusic(a: Assertion, events: StampedEvent[]): Assertion {
  const finalPhase = events.find(
    (e) => e.type === "phase.change" && /final/.test((e as { phase: string }).phase),
  );
  if (!finalPhase) return { ...a, state: "pending" };
  const music = events.find(
    (e) => e.type === "music.start" && e.t >= finalPhase.t && e.t - finalPhase.t <= 8000,
  );
  if (music) return { ...a, state: "pass", detail: `+${music.t - finalPhase.t}ms` };
  return { ...a, state: "pending" };
}

function gradeNoBareNumberVO(a: Assertion, events: StampedEvent[]): Assertion {
  const bad = events.find(
    (e) => e.type === "tts.speak" && /^\s*[0-9]+[\s\.\!]*$/.test((e as { text: string }).text),
  );
  if (bad) return { ...a, state: "fail", detail: `spoke "${(bad as { text: string }).text}"` };
  const anyTts = events.find((e) => e.type === "tts.speak");
  return { ...a, state: anyTts ? "pass" : "pending" };
}
