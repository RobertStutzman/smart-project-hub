// Client-side helper: speak text in The Elf's voice via ElevenLabs.
// Strategy: check pre-baked storage URLs first (free), then in-memory base64
// cache, then live ElevenLabs TTS as last resort. Single-line queue so lines
// never overlap.
import { speakPersonaLine } from "@/lib/announcer.functions";

type Preset = "hype" | "calm";

// text → signed storage URL (pre-baked persona pack). Seeded once per session.
const urlCache = new Map<string, string>();

// Active game room (set by HostGameStage). Threaded to the server so the
// per-game ElevenLabs call cap can charge the right room.
let activeRoomId: string | null = null;
export function setActiveRoomId(roomId: string | null) {
  activeRoomId = roomId;
}

export function initPersonaCache(map: Record<string, string>) {
  for (const [text, url] of Object.entries(map)) {
    urlCache.set(text, url);
  }
}

const CACHE_MAX = 64;
const cache = new Map<string, string>(); // key -> base64 mp3 OR "url::<https...>"
const URL_PREFIX = "url::";

// Persistent (localStorage) cache for URL entries only. Base64 audio is too
// big to safely persist (5MB quota). A storage URL is ~250B, so we can keep
// hundreds of dynamic lines (name-interpolated quips, habit callouts) across
// sessions and only pay ElevenLabs the first time each unique string is
// generated. URLs are signed for 7 days; the server re-signs on cache miss.
const PERSIST_KEY = "btd:elf-url-cache:v1";
const PERSIST_MAX = 300;
type PersistEntry = { v: string; t: number }; // value, last-used timestamp
let persistMap: Map<string, PersistEntry> | null = null;

function loadPersist(): Map<string, PersistEntry> {
  if (persistMap) return persistMap;
  persistMap = new Map();
  if (typeof window === "undefined") return persistMap;
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (!raw) return persistMap;
    const parsed = JSON.parse(raw) as Record<string, PersistEntry>;
    for (const [k, v] of Object.entries(parsed ?? {})) {
      if (v && typeof v.v === "string") persistMap.set(k, v);
    }
  } catch {
    /* corrupted or quota — start fresh */
  }
  return persistMap;
}

let flushTimer: number | null = null;
function flushPersist() {
  if (!persistMap || typeof window === "undefined") return;
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    if (!persistMap) return;
    // Trim to PERSIST_MAX by oldest-used timestamp.
    if (persistMap.size > PERSIST_MAX) {
      const sorted = [...persistMap.entries()].sort((a, b) => a[1].t - b[1].t);
      persistMap = new Map(sorted.slice(sorted.length - PERSIST_MAX));
    }
    try {
      const obj: Record<string, PersistEntry> = {};
      for (const [k, v] of persistMap) obj[k] = v;
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(obj));
    } catch {
      /* quota — drop silently */
    }
  }, 1500);
}

function cacheGet(key: string): string | undefined {
  const v = cache.get(key);
  if (v !== undefined) {
    cache.delete(key);
    cache.set(key, v);
    return v;
  }
  // Fall back to persistent URL cache.
  const pm = loadPersist();
  const hit = pm.get(key);
  if (hit) {
    hit.t = Date.now();
    flushPersist();
    cache.set(key, URL_PREFIX + hit.v);
    return URL_PREFIX + hit.v;
  }
  return undefined;
}

function cacheSet(key: string, val: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
  // Persist URL entries only — base64 blobs blow past the 5MB quota fast.
  if (val.startsWith(URL_PREFIX)) {
    const pm = loadPersist();
    pm.set(key, { v: val.slice(URL_PREFIX.length), t: Date.now() });
    flushPersist();
  }
}


type FetchResult =
  | { kind: "url"; url: string }
  | { kind: "base64"; b64: string }
  | { kind: "skipped" }
  | null;

async function fetchAudio(text: string, preset: Preset): Promise<FetchResult> {
  const key = `${preset}::${text}`;
  const hit = cacheGet(key);
  if (hit) {
    return hit.startsWith(URL_PREFIX)
      ? { kind: "url", url: hit.slice(URL_PREFIX.length) }
      : { kind: "base64", b64: hit };
  }
  try {
    const res = await speakPersonaLine({
      data: { text, preset, roomId: activeRoomId ?? undefined },
    });
    if (res && "skipped" in res && res.skipped) return { kind: "skipped" };
    if (res && "audioUrl" in res && res.audioUrl) {
      cacheSet(key, URL_PREFIX + res.audioUrl);
      return { kind: "url", url: res.audioUrl };
    }
    if (res && "audioBase64" in res && res.audioBase64) {
      cacheSet(key, res.audioBase64);
      return { kind: "base64", b64: res.audioBase64 };
    }
  } catch {
    /* silent fail — never crash the game */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Singleton playback element.
//
// ALL announcer audio routes through ONE <audio> element. Safari (and strict
// Chrome autoplay modes) require a user gesture per element — creating a new
// Audio() for every line means every play() rejects with NotAllowedError and
// the line dies silently. With a single element, one gesture "blesses" it
// forever; subsequent programmatic src swaps + play() are allowed.
// Lines blocked before the first gesture are parked and retried on the next
// gesture (see unlockElfVoice, wired into the global listener in __root.tsx).
// ---------------------------------------------------------------------------
let voiceEl: HTMLAudioElement | null = null;
let voiceBusy = false;
let playbackToken = 0;
let blessed = false;
let pendingRetry: { retry: () => void; cancel: () => void } | null = null;

// ~10ms of 8-bit silence. Used only to bless the element inside a gesture.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

function getVoiceEl(): HTMLAudioElement {
  if (!voiceEl) {
    voiceEl = new Audio();
    voiceEl.preload = "auto";
  }
  return voiceEl;
}

/**
 * Must be called synchronously from a user gesture handler (pointerdown /
 * keydown / touchstart). Replays any line that was blocked by autoplay
 * policy, or primes the shared element with a silent clip so future lines
 * can play without a gesture.
 */
export function unlockElfVoice() {
  if (typeof window === "undefined") return;
  if (pendingRetry) {
    const parked = pendingRetry;
    pendingRetry = null;
    parked.retry(); // play() runs inside the gesture frame
    blessed = true;
    return;
  }
  if (blessed || voiceBusy) return;
  const el = getVoiceEl();
  try {
    el.muted = true;
    el.src = SILENT_WAV;
    const p = el.play();
    void p
      ?.then(() => {
        blessed = true;
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        el.muted = false;
      })
      .catch(() => {
        el.muted = false;
      });
  } catch {
    el.muted = false;
  }
}

// Auto-duck music beds under every TTS / voice-URL playback so the voice
// always sits on top. Uses a refcount so overlapping calls don't un-duck
// each other prematurely.
let duckCount = 0;
function beginDuck() {
  duckCount++;
  if (duckCount === 1) {
    void import("@/lib/sound-engine").then((m) => m.duckMusic?.(true)).catch(() => {});
  }
}
function endDuck() {
  duckCount = Math.max(0, duckCount - 1);
  if (duckCount === 0) {
    void import("@/lib/sound-engine").then((m) => m.duckMusic?.(false)).catch(() => {});
  }
}

/**
 * Play a URL (https or data:) through the shared voice element. Resolves when
 * playback finishes, errors, or is cancelled. If autoplay policy blocks the
 * play() call, the line is parked and retried on the next user gesture
 * instead of being dropped silently.
 */
function playUrl(
  url: string,
  volume: number,
  hooks?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  return new Promise<void>((resolve) => {
    const el = getVoiceEl();
    const myToken = ++playbackToken;
    let started = false;
    let ducked = false;
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("ended", cleanup);
      el.removeEventListener("pause", cleanup);
      el.removeEventListener("error", cleanup);
      if (myToken === playbackToken) voiceBusy = false;
      if (ducked) {
        ducked = false;
        endDuck();
      }
      if (started) {
        try {
          hooks?.onEnd?.();
        } catch {
          /* ignore */
        }
      }
      resolve();
    };
    el.addEventListener("ended", cleanup);
    el.addEventListener("pause", cleanup);
    el.addEventListener("error", cleanup);
    voiceBusy = true;
    try {
      el.muted = false;
      el.volume = volume;
      el.src = url;
    } catch {
      cleanup();
      return;
    }
    const attempt = () =>
      el.play().then(() => {
        started = true;
        blessed = true;
        if (!ducked) {
          ducked = true;
          beginDuck();
        }
        try {
          hooks?.onStart?.();
        } catch {
          /* ignore */
        }
      });
    attempt().catch((err: unknown) => {
      const name = (err as DOMException | null)?.name;
      if (name === "NotAllowedError" && !settled) {
        // Autoplay-blocked: park for the next user gesture.
        blessed = false;
        pendingRetry = {
          retry: () => {
            if (settled || myToken !== playbackToken) {
              cleanup();
              return;
            }
            attempt().catch(cleanup);
          },
          cancel: cleanup,
        };
      } else {
        cleanup();
      }
    });
  });
}

export interface SpeakOptions {
  preset?: Preset;
  volume?: number;
  /** If true, interrupt anything currently playing. Default: queue behind. */
  interrupt?: boolean;
  /**
   * Audio Queue Manager priority. Lower number = higher priority.
   *   1 = Game-critical (host question read, DYK, essential announcements).
   *   2 = Mid-question player roasts / habit callouts.
   * P1 items are inserted ahead of all P2 items already waiting. The
   * currently playing line is NEVER preempted — interruption is opt-in
   * via `interrupt: true`.
   */
  priority?: 1 | 2;
  /**
   * Absolute deadline (Date.now() ms). If the queue hasn't reached this
   * task by `deadline`, it's silently dropped. Use for situational
   * callouts that are meaningless after the question ends.
   */
  deadline?: number;
}

/** Bumped on every cancelElfSpeech() so already-queued tasks can bail out. */
let generation = 0;

// ─── Audio Queue Manager ───────────────────────────────────────────────
// Array-backed scheduler so we can insert P1 ahead of P2 and skip tasks
// whose deadline has passed. ONE voice file ever plays at a time. A 200ms
// safe gap separates consecutive plays so the seam sounds clean. Music
// ducking is held across the entire batch — beds only restore once the
// queue fully drains, not between individual lines.
type QueueTask = {
  priority: 1 | 2;
  deadline?: number;
  gen: number;
  run: () => Promise<void>;
  resolve: () => void;
};
const tasks: QueueTask[] = [];
let pumping = false;
let pumpHoldingDuck = false;
const SAFE_GAP_MS = 200;

function schedule(task: QueueTask) {
  // Stable insert: keep items already in front of equal-priority items in
  // their original order; place this task before any item with strictly
  // higher (numerically larger) priority.
  let i = tasks.length;
  while (i > 0 && tasks[i - 1].priority > task.priority) i--;
  tasks.splice(i, 0, task);
  void pump();
}

async function pump() {
  if (pumping || typeof window === "undefined") return;
  pumping = true;
  if (!pumpHoldingDuck) {
    pumpHoldingDuck = true;
    beginDuck(); // hold music ducked across the whole batch
  }
  try {
    while (tasks.length > 0) {
      const next = tasks.shift()!;
      if (next.gen !== generation) { next.resolve(); continue; }
      if (next.deadline !== undefined && Date.now() > next.deadline) {
        next.resolve();
        continue;
      }
      try {
        await next.run();
      } catch {
        /* swallow — never crash the queue */
      }
      next.resolve();
      if (tasks.length > 0) {
        await new Promise<void>((r) => window.setTimeout(r, SAFE_GAP_MS));
      }
    }
  } finally {
    pumping = false;
    if (pumpHoldingDuck) {
      pumpHoldingDuck = false;
      endDuck();
    }
  }
}

/**
 * Hard-mute window. While `silenceUntil > Date.now()`, every new
 * `speakAsElf` / `playVoiceUrl` call is a no-op. Used at room-reset
 * boundaries so late-arriving callouts (persona-live, orchestrator
 * effects firing during the server round-trip) can't sneak through.
 */
let silenceUntil = 0;

export function silenceFor(ms: number) {
  silenceUntil = Math.max(silenceUntil, Date.now() + Math.max(0, ms));
  cancelElfSpeech();
}

/** Speak a line as The Elf. Returns when playback finishes (or fails silently). */
export function speakAsElf(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (Date.now() < silenceUntil) return Promise.resolve();
  const preset = opts.preset ?? "hype";
  const volume = opts.volume ?? 1.0;
  const priority = opts.priority ?? 1;
  const deadline = opts.deadline;

  if (opts.interrupt) cancelElfSpeech();
  const myGen = generation;

  const task = async () => {
    const isAlive = () => generation === myGen;
    if (!isAlive()) return;
    if (deadline !== undefined && Date.now() > deadline) return;
    // 1. Pre-baked URL (free, instant)
    const baked = urlCache.get(text);
    if (baked) {
      await playUrl(baked, volume);
      return;
    }
    // 2. URL/base64 from cache or live ElevenLabs
    const res = await fetchAudio(text, preset);
    if (!isAlive()) return;
    if (deadline !== undefined && Date.now() > deadline) return;
    if (!res || res.kind === "skipped") return;
    if (res.kind === "url") {
      await playUrl(res.url, volume);
      return;
    }
    await playUrl(`data:audio/mpeg;base64,${res.b64}`, volume);
  };

  // Safety: never let a hung TTS request stall the queue indefinitely.
  const safe = () =>
    Promise.race<void>([
      task(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 12000)),
    ]);

  return new Promise<void>((resolve) => {
    schedule({ priority, deadline, gen: myGen, run: safe, resolve });
  });
}

/** Stop any currently playing Elf line and drop everything already queued. */
export function cancelElfSpeech() {
  generation++;
  if (pendingRetry) {
    const parked = pendingRetry;
    pendingRetry = null;
    parked.cancel();
  }
  if (voiceEl) {
    try {
      if (!voiceEl.paused) voiceEl.pause();
    } catch {
      /* ignore */
    }
  }
  voiceBusy = false;
  // Resolve and drop every queued task so awaiters don't hang.
  while (tasks.length > 0) {
    const t = tasks.shift()!;
    try { t.resolve(); } catch { /* ignore */ }
  }
}

/** True if any Elf line is currently playing (or parked awaiting unlock). */
export function isElfSpeaking(): boolean {
  return voiceBusy || tasks.length > 0;
}

/** Pre-warm the cache for a set of lines (fire-and-forget). */
export function prewarmElfLines(lines: string[], preset: Preset = "hype") {
  for (const text of lines) {
    void fetchAudio(text, preset);
  }
}

/**
 * Play an arbitrary audio URL through the same single-line voice queue used
 * by speakAsElf. Use this for question prompts and DYK explanations so they
 * never overlap a persona reaction (or each other).
 */
export function playVoiceUrl(
  url: string,
  opts: {
    volume?: number;
    interrupt?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
    priority?: 1 | 2;
    deadline?: number;
  } = {},
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (Date.now() < silenceUntil) return Promise.resolve();
  const volume = opts.volume ?? 1.0;
  const priority = opts.priority ?? 1;
  const deadline = opts.deadline;

  if (opts.interrupt) cancelElfSpeech();
  const myGen = generation;

  const task = async () => {
    if (generation !== myGen) return;
    if (deadline !== undefined && Date.now() > deadline) return;
    await playUrl(url, volume, { onStart: opts.onStart, onEnd: opts.onEnd });
  };

  return new Promise<void>((resolve) => {
    schedule({ priority, deadline, gen: myGen, run: task, resolve });
  });
}
