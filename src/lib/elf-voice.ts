// Client-side helper: speak text in The Elf's voice via ElevenLabs.
// In-memory LRU cache + single-line queue so repeat catchphrases are instant
// and lines never overlap.
import { speakPersonaLine } from "@/lib/announcer.functions";

type Preset = "hype" | "calm";

const CACHE_MAX = 64;
const cache = new Map<string, string>(); // key -> base64 mp3

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

async function fetchAudio(text: string, preset: Preset): Promise<string | null> {
  const key = `${preset}::${text}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  try {
    const res = await speakPersonaLine({ data: { text, preset } });
    if (res?.audioBase64) {
      cacheSet(key, res.audioBase64);
      return res.audioBase64;
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
    const b64 = await fetchAudio(text, preset);
    if (!b64) return;
    await new Promise<void>((resolve) => {
      playBase64(b64, volume, resolve);
    });
  };

  queue = queue.then(task, task);
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

/** Pre-warm the cache for a set of lines (fire-and-forget). */
export function prewarmElfLines(lines: string[], preset: Preset = "hype") {
  for (const text of lines) {
    void fetchAudio(text, preset);
  }
}
