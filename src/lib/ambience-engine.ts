// Layered ambience engine — survives route changes, runs alongside sound-engine.
// Lobby chatter (pre-game venue murmur) + crowd cheering + drumroll buildup that
// hands off to game-show music.

import crowdAsset from "@/assets/audio/crowd-ambience.mp3.asset.json";
import drumAsset from "@/assets/audio/drumroll-build.mp3.asset.json";
import cymbalAsset from "@/assets/audio/cymbal-swell.mp3.asset.json";
import chatterAsset from "@/assets/audio/lobby-chatter.mp3.asset.json";

const CHATTER_TARGET = 0.28;
const CROWD_TARGET = 0.18;
const DRUM_TARGET = 0.22;
const CYMBAL_VOL = 0.6;
const FADE_MS = 800;

type Layer = { el: HTMLAudioElement; target: number };

let chatter: Layer | null = null;
let crowd: Layer | null = null;
let drum: Layer | null = null;
let muted = false;
let handedOff = false;

function isClient() {
  return typeof window !== "undefined";
}

function fade(layer: Layer, to: number, ms: number, onDone?: () => void) {
  const el = layer.el;
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

function ensureLayer(
  current: Layer | null,
  url: string,
  target: number,
): Layer {
  if (current) return current;
  const el = new Audio(url);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  return { el, target };
}

// Track autoplay-block state so the UI / route hooks can stop retry loops
// once playback actually succeeds.
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

/** Returns true if play() resolved (or was synchronous), false if blocked. */
function tryPlay(layer: Layer, target: number): Promise<boolean> {
  const { el } = layer;
  let p: Promise<void> | undefined;
  try {
    p = el.play();
  } catch (err) {
    console.warn("[ambience] play() threw", err);
    setBlocked(true);
    return Promise.resolve(false);
  }
  if (p && typeof p.then === "function") {
    return p.then(() => {
      fade(layer, target, FADE_MS);
      setBlocked(false);
      return true;
    }).catch((err) => {
      console.warn("[ambience] play() rejected:", err?.name ?? err);
      setBlocked(true);
      return false;
    });
  }
  fade(layer, target, FADE_MS);
  setBlocked(false);
  return Promise.resolve(true);
}

export function startLobbyChatter(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  chatter = ensureLayer(chatter, chatterAsset.url, CHATTER_TARGET);
  if (!chatter.el.paused) return Promise.resolve(true);
  return tryPlay(chatter, CHATTER_TARGET);
}

export function startCrowd(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  crowd = ensureLayer(crowd, crowdAsset.url, CROWD_TARGET);
  if (!crowd.el.paused) return Promise.resolve(true);
  return tryPlay(crowd, CROWD_TARGET);
}

export function startDrumroll(): Promise<boolean> {
  if (!isClient() || muted || handedOff) return Promise.resolve(false);
  drum = ensureLayer(drum, drumAsset.url, DRUM_TARGET);
  if (!drum.el.paused) return Promise.resolve(true);
  return tryPlay(drum, DRUM_TARGET);
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
  if (chatter) {
    const ch = chatter;
    fade(ch, 0, 700, () => {
      ch.el.pause();
    });
    chatter = null;
  }
  if (crowd) {
    const c = crowd;
    fade(c, 0, 700, () => {
      c.el.pause();
    });
    crowd = null;
  }
  if (drum) {
    const d = drum;
    fade(d, 0, 500, () => {
      d.el.pause();
    });
    drum = null;
  }
}

export function stopAllAmbience() {
  for (const l of [chatter, crowd, drum]) {
    if (!l) continue;
    try {
      l.el.pause();
      l.el.currentTime = 0;
    } catch {}
  }
  chatter = null;
  crowd = null;
  drum = null;
}

/** Fade out crowd + drumroll only; chatter persists as the pre-game layer. */
export function stopLobbyBuildup() {
  if (crowd) {
    const c = crowd;
    fade(c, 0, 600, () => {
      try { c.el.pause(); c.el.currentTime = 0; } catch {}
    });
    crowd = null;
  }
  if (drum) {
    const d = drum;
    fade(d, 0, 500, () => {
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
