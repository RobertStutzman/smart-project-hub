// Layered ambience engine — survives route changes, runs alongside sound-engine.
//
// Looped layers are scheduled through Web Audio with overlapping crossfades.
// That avoids both HTMLAudioElement.loop decode gaps and source files that have
// quiet tails baked into their endings. Continuous beds never use native
// AudioBufferSourceNode.loop; they overlap fresh one-shot sources instead.

import drumAsset from "@/assets/audio/drumroll-build.mp3.asset.json";
import cymbalAsset from "@/assets/audio/cymbal-swell.mp3.asset.json";
import crowdSeamlessAsset from "@/assets/audio/crowd-ambience-seamless.wav.asset.json";
import { emitDebug } from "@/lib/debug-bus";

const CHATTER_TARGET = 0.11;
const CROWD_TARGET = 0.5;
const DRUM_TARGET = 0.22;
const CYMBAL_VOL = 0.6;
const FADE_MS = 800;
const SCHEDULE_AHEAD_SEC = 24;
const SCHEDULE_TICK_MS = 2000;

function canUseAudioUrl(url: string | null | undefined): url is string {
  return !!url && !url.includes("/__l5e/");
}

let muted = false;
let handedOff = false;

// Track which layers were requested while the context was blocked, so we can
// resume them after the user's first gesture unlocks audio.
const wanted = new Set<"chatter" | "crowd" | "drumroll">();


function isClient() {
  return typeof window !== "undefined";
}

// ─── AudioContext (lazy, separate from sound-engine to avoid coupling) ──

let actx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!isClient()) return null;
  if (!actx) {
    const Ctor =
      (window.AudioContext as typeof AudioContext | undefined) ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext as
        | typeof AudioContext
        | undefined);
    if (!Ctor) return null;
    actx = new Ctor();
  }
  return actx;
}

// ─── Blocked-state surface (autoplay gating) ────────────────────────────

let blocked = false;
const blockListeners = new Set<(blocked: boolean) => void>();

function setBlocked(v: boolean) {
  if (blocked === v) return;
  blocked = v;
  if (v) console.warn("[ambience] autoplay blocked — waiting for user gesture");
  else console.info("[ambience] playback resumed");
  for (const cb of blockListeners) {
    try {
      cb(v);
    } catch {
      /* ignore listener failures */
    }
  }
}

export function isAmbienceBlocked() {
  return blocked;
}

export function onAmbienceBlockedChange(cb: (blocked: boolean) => void) {
  blockListeners.add(cb);
  return () => blockListeners.delete(cb);
}

// ─── Buffer cache + crossfaded loop layers ──────────────────────────────

const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  if (!canUseAudioUrl(url)) return null;
  let p = bufferCache.get(url);
  if (p) return p;
  p = (async () => {
    const ctx = getCtx();
    if (!ctx) return null;
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      return await ctx.decodeAudioData(ab.slice(0));
    } catch (e) {
      console.warn("[ambience] failed to load", url, e);
      return null;
    }
  })();
  bufferCache.set(url, p);
  return p;
}

type LoopLayer = {
  url: string;
  target: number;
  continuous?: boolean;
  loopStart: number;
  loopEnd?: number;
  loopEndTrim: number;
  crossfadeSec: number;
  buffer: AudioBuffer | null;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
  playing: boolean;
  nextStartTime: number;
  timer: number | null;
  sources: Set<AudioBufferSourceNode>;
};

function makeLoopLayer(
  url: string,
  target: number,
  opts: { loopStart?: number; loopEnd?: number; loopEndTrim?: number; crossfadeSec?: number; continuous?: boolean } = {},
): LoopLayer {
  return {
    url,
    target,
    continuous: opts.continuous,
    loopStart: opts.loopStart ?? 0,
    loopEnd: opts.loopEnd,
    loopEndTrim: opts.loopEndTrim ?? 0,
    crossfadeSec: opts.crossfadeSec ?? 1.2,
    buffer: null,
    gain: null,
    source: null,
    playing: false,
    nextStartTime: 0,
    timer: null,
    sources: new Set(),
  };
}

const drumroll: LoopLayer = makeLoopLayer(drumAsset.url, DRUM_TARGET, {
  // The drumroll source contains several seconds of trailing silence. Treat it
  // as a trimmed, crossfaded Web Audio loop instead of an HTML audio loop.
  loopStart: 0.45,
  loopEnd: 6.7,
  crossfadeSec: 0.55,
});

// ─── HTML Audio layer backend (for seamless beds) ───────────────────────
// The seamless crowd WAV loops cleanly on its own. HTMLAudioElement.loop is
// far more resilient than the Web Audio scheduler (survives tab suspension
// and OS audio policy quirks), so we use it for chatter + crowd.

type HtmlLayer = {
  url: string;
  target: number;
  audio: HTMLAudioElement | null;
  wantPlaying: boolean;
};

const chatterHtml: HtmlLayer = { url: crowdSeamlessAsset.url, target: CHATTER_TARGET, audio: null, wantPlaying: false };
const crowdHtml: HtmlLayer = { url: crowdSeamlessAsset.url, target: CROWD_TARGET, audio: null, wantPlaying: false };

function ensureHtmlAudio(layer: HtmlLayer): HTMLAudioElement | null {
  if (!isClient()) return null;
  if (!layer.audio) {
    const a = new Audio(layer.url);
    a.loop = true;
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.volume = 0;
    layer.audio = a;
  }
  return layer.audio;
}

async function startHtmlLayer(layer: HtmlLayer): Promise<boolean> {
  if (!isClient() || muted || handedOff) return false;
  if (!canUseAudioUrl(layer.url)) return false;
  layer.wantPlaying = true;
  const a = ensureHtmlAudio(layer);
  if (!a) return false;
  a.volume = Math.max(0, Math.min(1, layer.target * duckMultiplier));
  try {
    await a.play();
    setBlocked(false);
    return true;
  } catch {
    setBlocked(true);
    return false;
  }
}

function stopHtmlLayer(layer: HtmlLayer, fadeMs = 0) {
  layer.wantPlaying = false;
  const a = layer.audio;
  if (!a) return;
  if (fadeMs <= 0) {
    try { a.pause(); } catch { /* ignore */ }
    a.volume = 0;
    try { a.currentTime = 0; } catch { /* ignore */ }
    return;
  }
  const startVol = a.volume;
  const steps = 12;
  const stepMs = fadeMs / steps;
  let i = 0;
  const id = window.setInterval(() => {
    i += 1;
    const v = startVol * (1 - i / steps);
    a.volume = Math.max(0, v);
    if (i >= steps) {
      window.clearInterval(id);
      try { a.pause(); } catch { /* ignore */ }
    }
  }, stepMs);
}

function applyDuckToHtml(layer: HtmlLayer) {
  if (!layer.audio || !layer.wantPlaying) return;
  layer.audio.volume = Math.max(0, Math.min(1, layer.target * duckMultiplier));
}

function rampGain(g: GainNode, to: number, ms: number, ctx: AudioContext) {
  const now = ctx.currentTime;
  const cur = g.gain.value;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(cur, now);
  if (ms <= 0) g.gain.setValueAtTime(to, now);
  else g.gain.linearRampToValueAtTime(to, now + ms / 1000);
}

function getLoopBounds(layer: LoopLayer, buffer: AudioBuffer) {
  const start = Math.max(0, Math.min(layer.loopStart, buffer.duration - 0.5));
  const requestedEnd = layer.loopEnd ?? buffer.duration - layer.loopEndTrim;
  const end = Math.max(start + 0.5, Math.min(requestedEnd, buffer.duration));
  const duration = end - start;
  const crossfade = Math.min(layer.crossfadeSec, duration / 2.2);
  return {
    start,
    duration,
    crossfade,
    step: Math.max(0.25, duration - crossfade),
  };
}

// Equal-power (cos/sin) crossfade curves. Linear ramps on uncorrelated
// ambience sum to a ~-3 to -6 dB dip in the middle, which is heard as a gap.
const CURVE_LEN = 256;
const FADE_IN_CURVE = new Float32Array(CURVE_LEN);
const FADE_OUT_CURVE = new Float32Array(CURVE_LEN);
for (let i = 0; i < CURVE_LEN; i++) {
  const t = i / (CURVE_LEN - 1);
  FADE_IN_CURVE[i] = Math.sin((t * Math.PI) / 2);
  FADE_OUT_CURVE[i] = Math.cos((t * Math.PI) / 2);
}

function scheduleSource(layer: LoopLayer, when: number) {
  const ctx = getCtx();
  if (!ctx || !layer.buffer || !layer.gain || !layer.playing) return;

  const { start, duration, crossfade } = getLoopBounds(layer, layer.buffer);
  const src = ctx.createBufferSource();
  const srcGain = ctx.createGain();
  src.buffer = layer.buffer;

  const fadeOutStart = when + duration - crossfade;
  const stopAt = when + duration;

  srcGain.gain.setValueAtTime(0, when);
  // Fade in over the first `crossfade` seconds (equal-power).
  try {
    srcGain.gain.setValueCurveAtTime(FADE_IN_CURVE, when, crossfade);
  } catch {
    srcGain.gain.linearRampToValueAtTime(1, when + crossfade);
  }
  srcGain.gain.setValueAtTime(1, fadeOutStart);
  try {
    srcGain.gain.setValueCurveAtTime(FADE_OUT_CURVE, fadeOutStart, crossfade);
  } catch {
    srcGain.gain.linearRampToValueAtTime(0, stopAt);
  }

  src.connect(srcGain).connect(layer.gain);
  src.onended = () => layer.sources.delete(src);
  layer.sources.add(src);

  try {
    src.start(when, start, duration);
    src.stop(stopAt + 0.05);
  } catch {
    layer.sources.delete(src);
  }
}


function pumpScheduler(layer: LoopLayer) {
  const ctx = getCtx();
  if (!ctx || !layer.playing || !layer.buffer || !layer.gain) return;

  const { step } = getLoopBounds(layer, layer.buffer);
  if (layer.nextStartTime < ctx.currentTime - 0.25) {
    layer.nextStartTime = ctx.currentTime;
  }

  while (layer.nextStartTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleSource(layer, layer.nextStartTime);
    layer.nextStartTime += step;
  }

  layer.timer = window.setTimeout(() => pumpScheduler(layer), SCHEDULE_TICK_MS);
}

async function startLoop(layer: LoopLayer): Promise<boolean> {
  if (!isClient() || muted || handedOff) return false;
  const ctx = getCtx();
  if (!ctx) return false;

  // Try to resume the context — may be blocked until a user gesture.
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* ignore — will check state below */
    }
  }
  if (ctx.state !== "running") {
    setBlocked(true);
    return false;
  }

  // Already playing — just make sure gain is at target.
  if (layer.playing && layer.gain) {
    rampGain(layer.gain, layer.target, FADE_MS, ctx);
    setBlocked(false);
    return true;
  }

  const buf = await loadBuffer(layer.url);
  if (!buf) return false;

  // Double-check we weren't muted / handed off / started while awaiting.
  if (muted || handedOff) return false;
  if (layer.playing && layer.gain) {
    rampGain(layer.gain, layer.target, FADE_MS, ctx);
    return true;
  }

  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(ctx.destination);

  layer.buffer = buf;
  layer.gain = g;
  layer.sources = new Set();
  layer.nextStartTime = ctx.currentTime;
  layer.playing = true;
  if (layer.timer != null) window.clearTimeout(layer.timer);

  pumpScheduler(layer);
  rampGain(g, layer.target, FADE_MS, ctx);
  setBlocked(false);
  return true;
}

function stopLoop(layer: LoopLayer, fadeMs: number) {
  const ctx = getCtx();
  if (layer.timer != null && isClient()) window.clearTimeout(layer.timer);
  layer.timer = null;

  if (!ctx || !layer.playing || !layer.gain) {
    layer.playing = false;
    layer.gain = null;
    layer.source = null;
    layer.sources.clear();
    return;
  }

  const g = layer.gain;
  const stopAt = ctx.currentTime + fadeMs / 1000 + 0.05;
  rampGain(g, 0, fadeMs, ctx);
  for (const src of layer.sources) {
    try {
      src.stop(stopAt);
    } catch {
      /* already stopped */
    }
  }
  layer.playing = false;
  layer.gain = null;
  layer.source = null;
  layer.sources.clear();
}

// ─── Visibility / unlock watchdog ───────────────────────────────────────

let watchdogInstalled = false;

function installWatchdog() {
  if (watchdogInstalled || !isClient()) return;
  watchdogInstalled = true;
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    resumeAmbienceContext();
    retryBlockedAmbience();
  };
  document.addEventListener("visibilitychange", onVisible);
  // Also nudge on focus — some browsers fire focus without visibilitychange.
  window.addEventListener("focus", onVisible);
}

// ─── Public API ─────────────────────────────────────────────────────────

export function startLobbyChatter(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  wanted.add("chatter");
  installWatchdog();
  return startHtmlLayer(chatterHtml);
}

export function startCrowd(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  wanted.add("crowd");
  installWatchdog();
  return startHtmlLayer(crowdHtml);
}

export function startDrumroll(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  wanted.add("drumroll");
  installWatchdog();
  return startLoop(drumroll);
}

/**
 * Synchronously create (if needed) and resume the ambience AudioContext.
 * Call from inside a user gesture handler to unlock playback.
 */
export function resumeAmbienceContext(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

/**
 * Retry any layers that were requested while the AudioContext was blocked,
 * or whose HTMLAudio element got paused (tab suspended, OS interrupt, etc.).
 * Safe to call multiple times; layers already playing are no-ops.
 */
export function retryBlockedAmbience(): void {
  if (!isClient() || muted || handedOff) return;
  if (wanted.has("chatter")) {
    const a = chatterHtml.audio;
    if (!a || a.paused) void startHtmlLayer(chatterHtml);
  }
  if (wanted.has("crowd")) {
    const a = crowdHtml.audio;
    if (!a || a.paused) void startHtmlLayer(crowdHtml);
  }
  if (wanted.has("drumroll")) void startLoop(drumroll);
}


/** Plays cymbal swell, fades out ambience, ready for game-show music. */
export function climaxAndHandoff() {
  if (!isClient() || handedOff) return;
  handedOff = true;
  if (!muted && canUseAudioUrl(cymbalAsset.url)) {
    const swell = new Audio(cymbalAsset.url);
    swell.volume = CYMBAL_VOL;
    swell.play().catch(() => {});
  }
  wanted.clear();
  stopHtmlLayer(chatterHtml, 700);
  stopHtmlLayer(crowdHtml, 700);
  stopLoop(drumroll, 500);
}

export function stopAllAmbience() {
  wanted.clear();
  stopHtmlLayer(chatterHtml, 0);
  stopHtmlLayer(crowdHtml, 0);
  stopLoop(drumroll, 0);
}

/** Fade out host buildup layers only; chatter persists as the pre-game layer. */
export function stopLobbyBuildup() {
  wanted.delete("crowd");
  wanted.delete("drumroll");
  stopHtmlLayer(crowdHtml, 600);
  stopLoop(drumroll, 500);
}


export function setAmbienceMuted(v: boolean) {
  const wasMuted = muted;
  muted = v;
  if (v) {
    stopHtmlLayer(chatterHtml, 0);
    stopHtmlLayer(crowdHtml, 0);
    stopLoop(drumroll, 0);
    // Preserve `wanted` so we can resume on unmute.
    return;
  }
  // Unmuting — restart anything that was wanted.
  if (wasMuted && !handedOff) {
    if (wanted.has("chatter")) void startHtmlLayer(chatterHtml);
    if (wanted.has("crowd")) void startHtmlLayer(crowdHtml);
    if (wanted.has("drumroll")) void startLoop(drumroll);
  }
}

// ─── Ducking (lower ambience under VO) ──────────────────────────────────

let duckMultiplier = 1;

function applyDuckToLayer(layer: LoopLayer, ms: number) {
  const ctx = getCtx();
  if (!ctx || !layer.gain || !layer.playing) return;
  rampGain(layer.gain, layer.target * duckMultiplier, ms, ctx);
}

export function duckAmbience(multiplier = 0.35, ms = 400) {
  duckMultiplier = Math.max(0, Math.min(1, multiplier));
  void ms;
  applyDuckToHtml(chatterHtml);
  applyDuckToHtml(crowdHtml);
  applyDuckToLayer(drumroll, ms);
}

export function unduckAmbience(ms = 500) {
  duckMultiplier = 1;
  void ms;
  applyDuckToHtml(chatterHtml);
  applyDuckToHtml(crowdHtml);
  applyDuckToLayer(drumroll, ms);
}

/** Reset the handoff latch (e.g. when returning to lobby for a new game). */
export function resetAmbience() {
  handedOff = false;
}

