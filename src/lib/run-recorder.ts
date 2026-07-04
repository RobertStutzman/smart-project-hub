// Instrumentation harness for the /dev QA runner. Wraps fetch and console
// during a run so downloadable reports include the full context (network
// failures, error logs, event stream, bot/room/assertion snapshots) — enough
// for someone else to diagnose a broken game without touching the machine.

import { subscribeDebugBus, type StampedEvent } from "@/lib/debug-bus";

export type FetchError = {
  t: number;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  body?: string;
};

export type ConsoleEntry = {
  t: number;
  level: "error" | "warn";
  text: string;
};

export type BotSnapshot = {
  t: number;
  bots: { key: string; name: string; state: string; score: number; error?: string }[];
};

export type RoomSnapshot = {
  t: number;
  room: unknown;
};

export type AssertionSnapshot = {
  t: number;
  assertions: { id: string; label: string; state: string; detail?: string }[];
};

export type RecorderData = {
  events: StampedEvent[];
  fetchErrors: FetchError[];
  consoleEntries: ConsoleEntry[];
  autoplayBlocked: boolean;
  botSnapshots: BotSnapshot[];
  roomSnapshots: RoomSnapshot[];
  assertionSnapshots: AssertionSnapshot[];
};

export type Recorder = {
  data: RecorderData;
  stop: () => void;
  snapshotBots: () => void;
  snapshotRoom: () => void;
  snapshotAssertions: () => void;
};

export type RecorderOptions = {
  getBots?: () => BotSnapshot["bots"];
  getRoom?: () => RoomSnapshot["room"];
  getAssertions?: () => AssertionSnapshot["assertions"];
};

const MAX_EVENTS = 2000;
const MAX_CONSOLE = 40;
const MAX_FETCH = 60;
const MAX_BOT_SNAPSHOTS = 30;
const MAX_ROOM_SNAPSHOTS = 30;
const MAX_ASSERTION_SNAPSHOTS = 30;

/** Start recording. Call the returned `stop()` when the run ends. */
export function startRecorder(opts: RecorderOptions = {}): Recorder {
  const data: RecorderData = {
    events: [],
    fetchErrors: [],
    consoleEntries: [],
    autoplayBlocked: false,
    botSnapshots: [],
    roomSnapshots: [],
    assertionSnapshots: [],
  };

  // --- Debug bus subscription -------------------------------------------
  const offBus = subscribeDebugBus((e) => {
    if (data.events.length >= MAX_EVENTS) data.events.shift();
    data.events.push(e);
    if (e.type === "ambience.blocked") data.autoplayBlocked = true;
    if (e.type === "phase.change") {
      snapshotRoom();
      snapshotBots();
      snapshotAssertions();
    }
  });

  // --- console.error / console.warn -------------------------------------
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  const push = (level: "error" | "warn", args: unknown[]) => {
    try {
      const text = args
        .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : safeStringify(a)))
        .join(" ");
      if (data.consoleEntries.length >= MAX_CONSOLE) data.consoleEntries.shift();
      data.consoleEntries.push({ t: Date.now(), level, text: text.slice(0, 500) });
    } catch { /* ignore */ }
  };
  console.error = (...args: unknown[]) => { push("error", args); origError(...args); };
  console.warn = (...args: unknown[]) => { push("warn", args); origWarn(...args); };

  // --- fetch wrapper (parent window only; iframe has its own scope) -----
  const origFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    try {
      const res = await origFetch(input as RequestInfo, init);
      if (!res.ok && looksInteresting(url)) {
        let body = "";
        try { body = (await res.clone().text()).slice(0, 400); } catch { /* ignore */ }
        if (data.fetchErrors.length >= MAX_FETCH) data.fetchErrors.shift();
        data.fetchErrors.push({
          t: Date.now(),
          url: shortUrl(url),
          method,
          status: res.status,
          durationMs: Math.round(performance.now() - started),
          body,
        });
      }
      return res;
    } catch (err) {
      if (looksInteresting(url)) {
        if (data.fetchErrors.length >= MAX_FETCH) data.fetchErrors.shift();
        data.fetchErrors.push({
          t: Date.now(),
          url: shortUrl(url),
          method,
          status: 0,
          durationMs: Math.round(performance.now() - started),
          body: (err as Error).message,
        });
      }
      throw err;
    }
  }) as typeof window.fetch;

  function snapshotBots() {
    if (!opts.getBots) return;
    try {
      const bots = opts.getBots();
      if (data.botSnapshots.length >= MAX_BOT_SNAPSHOTS) data.botSnapshots.shift();
      data.botSnapshots.push({ t: Date.now(), bots });
    } catch { /* ignore */ }
  }

  function snapshotRoom() {
    if (!opts.getRoom) return;
    try {
      const room = opts.getRoom();
      if (data.roomSnapshots.length >= MAX_ROOM_SNAPSHOTS) data.roomSnapshots.shift();
      data.roomSnapshots.push({ t: Date.now(), room });
    } catch { /* ignore */ }
  }

  function snapshotAssertions() {
    if (!opts.getAssertions) return;
    try {
      const assertions = opts.getAssertions();
      if (data.assertionSnapshots.length >= MAX_ASSERTION_SNAPSHOTS) data.assertionSnapshots.shift();
      data.assertionSnapshots.push({ t: Date.now(), assertions });
    } catch { /* ignore */ }
  }

  return {
    data,
    stop() {
      offBus();
      console.error = origError;
      console.warn = origWarn;
      window.fetch = origFetch;
    },
    snapshotBots,
    snapshotRoom,
    snapshotAssertions,
  };
}

function looksInteresting(url: string): boolean {
  return /\/api\/|supabase\.co\/|\/_?rpc\/|\.functions\.|\.supabase\.|createServerFn/.test(url);
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    return `${u.pathname}${u.search}`.slice(0, 200);
  } catch { return url.slice(0, 200); }
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v); } catch { return String(v); }
}
