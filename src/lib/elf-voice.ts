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

let currentAudio: HTMLAudioElement | null = null;
let queue: Promise<void> = Promise.resolve();

function cacheGet(key: string): string | undefined {
  const v = cache.get(key);
  if (v !== undefined) {
    // LRU bump
    cache.delete(key);
    cache.set(key, v);
  }
  return v;
}

function cacheSet(key: string, val: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
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

function playBase64(b64: string, volume: number, onEnd?: () => void): HTMLAudioElement {
  const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
  audio.volume = volume;
  const cleanup = () => {
    if (currentAudio === audio) currentAudio = null;
    onEnd?.();
  };
  audio.addEventListener("ended", cleanup);
  audio.addEventListener("pause", cleanup);
  audio.addEventListener("error", cleanup);
  currentAudio = audio;
  audio.play().catch(cleanup);
  return audio;
}

export interface SpeakOptions {
  preset?: Preset;
  volume?: number;
  /** If true, interrupt anything currently playing. Default: queue behind. */
  interrupt?: boolean;
}

/** Speak a line as The Elf. Returns when playback finishes (or fails silently). */
export function speakAsElf(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const preset = opts.preset ?? "hype";
  const volume = opts.volume ?? 1.0;

  const task = async () => {
    if (opts.interrupt) cancelElfSpeech();
    // 1. Pre-baked URL (free, instant)
    const url = urlCache.get(text);
    if (url) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.volume = volume;
        const cleanup = () => {
          if (currentAudio === audio) currentAudio = null;
          resolve();
        };
        audio.addEventListener("ended", cleanup);
        audio.addEventListener("pause", cleanup);
        audio.addEventListener("error", cleanup);
        currentAudio = audio;
        audio.play().catch(cleanup);
      });
      return;
    }
    // 2. URL/base64 from cache or live ElevenLabs
    const res = await fetchAudio(text, preset);
    if (!res || res.kind === "skipped") return;
    if (res.kind === "url") {
      await new Promise<void>((resolve) => {
        const audio = new Audio(res.url);
        audio.volume = volume;
        const cleanup = () => {
          if (currentAudio === audio) currentAudio = null;
          resolve();
        };
        audio.addEventListener("ended", cleanup);
        audio.addEventListener("pause", cleanup);
        audio.addEventListener("error", cleanup);
        currentAudio = audio;
        audio.play().catch(cleanup);
      });
      return;
    }
    await new Promise<void>((resolve) => {
      playBase64(res.b64, volume, resolve);
    });
  };

  // Safety: never let a hung TTS request stall the queue indefinitely.
  const safe = () =>
    Promise.race<void>([
      task(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 12000)),
    ]);
  queue = queue.then(safe, safe);
  return queue;
}

/** Stop any currently playing Elf line and clear the queue. */
export function cancelElfSpeech() {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
  queue = Promise.resolve();
}

/** True if any Elf line is currently playing. */
export function isElfSpeaking(): boolean {
  return currentAudio !== null;
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
  } = {},
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const volume = opts.volume ?? 1.0;

  const task = async () => {
    if (opts.interrupt) cancelElfSpeech();
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audio.volume = volume;
      let started = false;
      const cleanup = () => {
        if (currentAudio === audio) currentAudio = null;
        if (started) {
          try { opts.onEnd?.(); } catch { /* ignore */ }
        }
        resolve();
      };
      audio.addEventListener("ended", cleanup);
      audio.addEventListener("pause", cleanup);
      audio.addEventListener("error", cleanup);
      currentAudio = audio;
      audio.play().then(() => {
        started = true;
        try { opts.onStart?.(); } catch { /* ignore */ }
      }).catch(cleanup);
    });
  };

  queue = queue.then(task, task);
  return queue;
}
