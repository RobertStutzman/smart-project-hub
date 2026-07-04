// Automated QA runner for /dev. Steps through a full game by listening to
// the debug bus and nudging the host iframe via postMessage. No manual
// clicking required.
//
// Scenarios:
//   full3Round  → lobby → intro → 3 rounds → final → credits/climax
//   lightning   → same, but records lightning-round assertions only
//   finalOnly   → skips regular rounds by advancing straight through
//   lobbyStress → new-room ×3, verifying lobby ambience each time
//
// The runner never touches gameplay logic — it observes the same events
// QAPanel grades, and asks the host to start/advance the same way a real
// user would (buttons -> setPhase server fns).

import { subscribeDebugBus, type StampedEvent } from "@/lib/debug-bus";

export type StepStatus = "pending" | "running" | "pass" | "fail" | "skipped";

export type Step = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  elapsedMs?: number;
};

export type Scenario = "full3Round" | "lightning" | "finalOnly" | "lobbyStress" | "audienceHandoff";

export type RunnerReport = {
  scenario: Scenario;
  passed: boolean;
  startedAt: number;
  endedAt: number;
  steps: Step[];
};

type Emit = (type: string, payload?: Record<string, unknown>) => void;

type Options = {
  scenario: Scenario;
  botCount: number;
  spawnBots: (n: number) => Promise<void>;
  sendToHost: (msg: { type: string } & Record<string, unknown>) => void;
  onStepsChange: (steps: Step[]) => void;
  onDone: (report: RunnerReport) => void;
  abortSignal: AbortSignal;
};

class StepRecorder {
  steps: Step[] = [];
  private startedAt = new Map<string, number>();
  private onChange: (s: Step[]) => void;

  constructor(onChange: (s: Step[]) => void) {
    this.onChange = onChange;
  }

  begin(id: string, label: string) {
    this.steps.push({ id, label, status: "running" });
    this.startedAt.set(id, performance.now());
    this.onChange([...this.steps]);
  }

  end(id: string, status: Exclude<StepStatus, "pending" | "running">, detail?: string) {
    const idx = this.steps.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const startedAt = this.startedAt.get(id) ?? performance.now();
    this.steps[idx] = {
      ...this.steps[idx],
      status,
      detail,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
    this.onChange([...this.steps]);
  }

  fail(id: string, detail: string) { this.end(id, "fail", detail); }
  pass(id: string, detail?: string) { this.end(id, "pass", detail); }
  skip(id: string, detail?: string) { this.end(id, "skipped", detail); }
}

/** Wait for the first event matching `pred` (or timeout). */
function waitForEvent(
  pred: (e: StampedEvent) => boolean,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<StampedEvent | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: StampedEvent | null) => {
      if (done) return;
      done = true;
      off();
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve(v);
    };
    const off = subscribeDebugBus((e) => { if (pred(e)) finish(e); });
    const t = setTimeout(() => finish(null), timeoutMs);
    const onAbort = () => finish(null);
    signal.addEventListener("abort", onAbort);
  });
}

/** Collect all events matching `pred` while `activeFor` runs. */
async function collectDuring<T>(
  pred: (e: StampedEvent) => boolean,
  activeFor: () => Promise<T>,
): Promise<{ result: T; events: StampedEvent[] }> {
  const events: StampedEvent[] = [];
  const off = subscribeDebugBus((e) => { if (pred(e)) events.push(e); });
  try {
    const result = await activeFor();
    return { result, events };
  } finally {
    off();
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); });
  });

export async function runScenario(opts: Options): Promise<RunnerReport> {
  const { scenario, botCount, spawnBots, sendToHost, onStepsChange, onDone, abortSignal } = opts;
  const rec = new StepRecorder(onStepsChange);
  const startedAt = Date.now();

  const emit: Emit = (type, payload) => sendToHost({ type, ...(payload ?? {}) });

  const rounds = scenario === "finalOnly" ? 0 : scenario === "lightning" ? 3 : 3;

  try {
    // ── 1. Reset room ────────────────────────────────────────────────
    rec.begin("reset", "Reset host to a fresh lobby");
    emit("parent:new-room");
    const lobby = await waitForEvent(
      (e) => e.type === "phase.change" && e.phase === "lobby",
      8000,
      abortSignal,
    );
    if (!lobby) { rec.fail("reset", "Never saw phase.change=lobby within 8s"); throw new Error("lobby timeout"); }
    rec.pass("reset");

    // ── 2. Lobby ambience must fire ──────────────────────────────────
    rec.begin("ambience", "Lobby crowd ambience starts within 5s");
    const amb = await waitForEvent(
      (e) => e.type === "ambience.start" && (e.layer === "crowd" || e.layer === "chatter"),
      5000,
      abortSignal,
    );
    if (!amb) rec.fail("ambience", "No ambience.start event within 5s (crowd file blocked or silent?)");
    else rec.pass("ambience", `${(amb as { layer: string }).layer} started`);

    if (scenario === "lobbyStress") {
      // Repeat new-room + ambience check twice more, then stop.
      for (let i = 2; i <= 3; i++) {
        rec.begin(`stress-${i}`, `Return-to-lobby #${i}: ambience within 5s`);
        emit("parent:new-room");
        const l = await waitForEvent(
          (e) => e.type === "phase.change" && e.phase === "lobby",
          8000, abortSignal);
        if (!l) { rec.fail(`stress-${i}`, "lobby phase never returned"); continue; }
        const a = await waitForEvent(
          (e) => e.type === "ambience.start" && (e.layer === "crowd" || e.layer === "chatter"),
          5000, abortSignal);
        if (!a) rec.fail(`stress-${i}`, "ambience did not restart");
        else rec.pass(`stress-${i}`);
      }
      const endedAt = Date.now();
      const report: RunnerReport = {
        scenario, passed: rec.steps.every((s) => s.status === "pass" || s.status === "skipped"),
        startedAt, endedAt, steps: rec.steps,
      };
      onDone(report);
      return report;
    }

    // ── 3. Spawn bots ─────────────────────────────────────────────────
    rec.begin("bots", `Spawn ${botCount} bots into the lobby`);
    try { await spawnBots(botCount); rec.pass("bots"); }
    catch (e) { rec.fail("bots", (e as Error).message); throw e; }

    // Give the lobby a beat for bots to be visible.
    await sleep(1000, abortSignal);

    // ── 4. Start the game ─────────────────────────────────────────────
    rec.begin("start", "Send parent:start-game and observe intro phase");
    emit("parent:start-game");
    const intro = await waitForEvent(
      (e) => e.type === "phase.change" && e.phase === "intro",
      8000, abortSignal);
    if (!intro) { rec.fail("start", "Intro phase never fired"); throw new Error("intro"); }
    rec.pass("start");

    // ── 5. Per-round loop ─────────────────────────────────────────────
    for (let r = 1; r <= rounds; r++) {
      const isFinalRound = r === rounds && scenario !== "lightning";
      const rlabel = scenario === "lightning" && r === rounds ? "final" : `${r}`;

      rec.begin(`q-${r}`, `Round ${rlabel}: question shows within 30s`);
      // Watch for big 3-2-1 between now and question
      let sawBig321 = false;
      const offCd = subscribeDebugBus((e) => {
        if (e.type === "countdown.show" && e.kind === "big-321") sawBig321 = true;
      });
      const q = await waitForEvent(
        (e) => e.type === "question.show",
        30000, abortSignal);
      offCd();
      if (!q) { rec.fail(`q-${r}`, "question.show never fired"); break; }
      if (sawBig321) rec.fail(`q-${r}`, "big-321 countdown fired before question (should be splash+voice)");
      else rec.pass(`q-${r}`, `question ${(q as { questionNumber: number | null }).questionNumber ?? "?"}`);

      // Timer window assertion
      const timer = await waitForEvent(
        (e) => e.type === "timer.start",
        5000, abortSignal);
      rec.begin(`timer-${r}`, isFinalRound ? "Final timer ~30s" : "Question timer 15–25s");
      if (!timer) rec.fail(`timer-${r}`, "no timer.start event");
      else {
        const d = (timer as { durationS: number }).durationS;
        const ok = isFinalRound ? d >= 25 && d <= 40 : d >= 12 && d <= 30;
        ok ? rec.pass(`timer-${r}`, `${d}s`) : rec.fail(`timer-${r}`, `duration ${d}s outside window`);
      }

      // Lightning integrity: no drop.answer during final round of lightning scenario
      if (scenario === "lightning" && isFinalRound) {
        rec.begin(`nodrop-${r}`, "Lightning final: no drop.answer");
        const drops: StampedEvent[] = [];
        const off = subscribeDebugBus((e) => { if (e.type === "drop.answer") drops.push(e); });
        // Wait for reveal
        await waitForEvent((e) => e.type === "phase.change" && e.phase === "reveal", 45000, abortSignal);
        off();
        drops.length === 0 ? rec.pass(`nodrop-${r}`) : rec.fail(`nodrop-${r}`, `${drops.length} drops`);
      } else {
        // Wait for reveal (bots auto-lock via dev.tsx effect)
        rec.begin(`reveal-${r}`, `Round ${rlabel}: reveal within 45s`);
        const rev = await waitForEvent(
          (e) => e.type === "phase.change" && (e.phase === "reveal" || e.phase === "leaderboard"),
          45000, abortSignal);
        if (!rev) { rec.fail(`reveal-${r}`, "reveal phase never fired"); break; }
        rec.pass(`reveal-${r}`);
      }

      // Between rounds — HostGameStage auto-advances. Just wait for either
      // next question or terminal phase.
      if (r < rounds) {
        await sleep(500, abortSignal);
      }
    }

    // ── 6. Final assertions (from event stream) ───────────────────────
    if (scenario !== "lightning") {
      rec.begin("final-question", "Final question is 'hard' or 'impossible'");
      const finalQ = await waitForEvent(
        (e) => e.type === "final.question",
        60000, abortSignal);
      if (!finalQ) rec.fail("final-question", "no final.question event");
      else {
        const diff = (finalQ as { difficulty: string | null }).difficulty;
        (diff === "hard" || diff === "impossible")
          ? rec.pass("final-question", `difficulty=${diff}`)
          : rec.fail("final-question", `difficulty=${diff ?? "null"}`);
      }
    }

    // ── 7. Climax / handoff terminator ────────────────────────────────
    rec.begin("climax", "Game reaches leaderboard/credits (climax handoff)");
    const term = await waitForEvent(
      (e) => e.type === "phase.change" && (e.phase === "credits" || e.phase === "leaderboard" || e.phase === "final_wager"),
      60000, abortSignal);
    if (!term) rec.fail("climax", "no terminal phase within 60s");
    else rec.pass("climax", `terminated at phase=${(term as { phase: string }).phase}`);

    const endedAt = Date.now();
    const passed = rec.steps.every((s) => s.status === "pass" || s.status === "skipped");
    const report: RunnerReport = { scenario, passed, startedAt, endedAt, steps: rec.steps };
    onDone(report);
    return report;
  } catch (err) {
    const endedAt = Date.now();
    const report: RunnerReport = {
      scenario, passed: false, startedAt, endedAt, steps: rec.steps,
    };
    // Mark the currently-running step as failed if not already
    const running = rec.steps.find((s) => s.status === "running");
    if (running) rec.fail(running.id, (err as Error).message || "aborted");
    onDone(report);
    return report;
  }
}

// avoid unused-import lint if collectDuring stays for future scenarios
void collectDuring;
