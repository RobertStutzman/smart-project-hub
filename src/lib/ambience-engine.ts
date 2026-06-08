// Layered ambience engine — survives route changes, runs alongside sound-engine.
//
// Looped layers (chatter, crowd) use Web Audio AudioBufferSourceNode with
// loop=true for sample-accurate, gapless looping. HTMLAudioElement.loop has
// an audible decode-gap between iterations on mp3 sources, which sounds
// unprofessional. One-shots (drumroll, cymbal) stay as HTMLAudioElement.

import crowdAsset from "@/assets/audio/crowd-ambience.mp3.asset.json";
import drumAsset from "@/assets/audio/drumroll-build.mp3.asset.json";
import cymbalAsset from "@/assets/audio/cymbal-swell.mp3.asset.json";
import chatterAsset from "@/assets/audio/lobby-chatter.mp3.asset.json";

const CHATTER_TARGET = 0.28;
const CROWD_TARGET = 0.18;
const DRUM_TARGET = 0.22;
const CYMBAL_VOL = 0.6;
const FADE_MS = 800;

let muted = false;
let handedOff = false;

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
      ((window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext as typeof AudioContext | undefined);
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
    try { cb(v); } catch {}
  }
}

export function isAmbienceBlocked() {
  return blocked;
}

export function onAmbienceBlockedChange(cb: (blocked: boolean) => void) {
  blockListeners.add(cb);
  return () => blockListeners.delete(cb);
}

// ─── Buffer cache + looped layer ────────────────────────────────────────

const bufferCache = new Map<string, Promise<AudioBuffer | null>>();

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
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
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  /** True once the source has been started and not stopped. */
  playing: boolean;
};

function makeLoopLayer(url: string, target: number): LoopLayer {
  return { url, target, source: null, gain: null, playing: false };
}

let chatter: LoopLayer = makeLoopLayer(chatterAsset.url, CHATTER_TARGET);
let crowd: LoopLayer = makeLoopLayer(crowdAsset.url, CROWD_TARGET);

function rampGain(g: GainNode, to: number, ms: number, ctx: AudioContext) {
  const now = ctx.currentTime;
  const cur = g.gain.value;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(cur, now);
  g.gain.linearRampToValueAtTime(to, now + ms / 1000);
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

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(g).connect(ctx.destination);
  src.start(0);

  layer.source = src;
  layer.gain = g;
  layer.playing = true;

  rampGain(g, layer.target, FADE_MS, ctx);
  setBlocked(false);
  return true;
}

function stopLoop(layer: LoopLayer, fadeMs: number) {
  const ctx = getCtx();
  if (!ctx || !layer.playing || !layer.gain || !layer.source) {
    layer.playing = false;
    layer.source = null;
    layer.gain = null;
    return;
  }
  const src = layer.source;
  const g = layer.gain;
  rampGain(g, 0, fadeMs, ctx);
  const stopAt = ctx.currentTime + fadeMs / 1000 + 0.02;
  try {
    src.stop(stopAt);
  } catch {
    /* already stopped */
  }
  layer.playing = false;
  layer.source = null;
  layer.gain = null;
}

// ─── One-shot HTMLAudioElement layer for drumroll ───────────────────────

type ElLayer = { el: HTMLAudioElement; target: number };
let drum: ElLayer | null = null;

function fadeEl(el: HTMLAudioElement, to: number, ms: number, onDone?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    el.volume = from + (to - from) * k;
    if (k < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
}

function ensureDrum(): ElLayer {
  if (drum) return drum;
  const el = new Audio(drumAsset.url);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  drum = { el, target: DRUM_TARGET };
  return drum;
}

async function tryPlayDrum(layer: ElLayer): Promise<boolean> {
  try {
    const p = layer.el.play();
    if (p && typeof p.then === "function") {
      await p;
    }
    fadeEl(layer.el, layer.target, FADE_MS);
    setBlocked(false);
    return true;
  } catch (err) {
    console.warn("[ambience] drum play rejected:", (err as Error)?.name ?? err);
    setBlocked(true);
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

export function startLobbyChatter(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  return startLoop(chatter);
}

export function startCrowd(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  return startLoop(crowd);
}

export function startDrumroll(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  const layer = ensureDrum();
  if (!layer.el.paused) return Promise.resolve(true);
  return tryPlayDrum(layer);
}

/** Plays cymbal swell, fades out chatter + crowd + drumroll, ready for game-show music. */
export function climaxAndHandoff() {
  if (!isClient() || handedOff) return;
  handedOff = true;
  if (!muted) {
    const swell = new Audio(cymbalAsset.url);
    swell.volume = CYMBAL_VOL;
    swell.play().catch(() => {});
  }
  stopLoop(chatter, 700);
  stopLoop(crowd, 700);
  if (drum) {
    const d = drum;
    fadeEl(d.el, 0, 500, () => {
      try { d.el.pause(); } catch {}
    });
    drum = null;
  }
}

export function stopAllAmbience() {
  stopLoop(chatter, 0);
  stopLoop(crowd, 0);
  if (drum) {
    try { drum.el.pause(); drum.el.currentTime = 0; } catch {}
    drum = null;
  }
}

/** Fade out crowd + drumroll only; chatter persists as the pre-game layer. */
export function stopLobbyBuildup() {
  stopLoop(crowd, 600);
  if (drum) {
    const d = drum;
    fadeEl(d.el, 0, 500, () => {
      try { d.el.pause(); d.el.currentTime = 0; } catch {}
    });
    drum = null;
  }
}

export function setAmbienceMuted(v: boolean) {
  muted = v;
  if (v) stopAllAmbience();
}

/** Reset the handoff latch (e.g. when returning to lobby for a new game). */
export function resetAmbience() {
  handedOff = false;
}
