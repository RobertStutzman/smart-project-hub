// Layered ambience engine — survives route changes, runs alongside sound-engine.
// Crowd ambience + drumroll buildup that hands off to game-show music.

import crowdAsset from "@/assets/audio/crowd-ambience.mp3.asset.json";
import drumAsset from "@/assets/audio/drumroll-build.mp3.asset.json";
import cymbalAsset from "@/assets/audio/cymbal-swell.mp3.asset.json";

const CROWD_TARGET = 0.18;
const DRUM_TARGET = 0.22;
const CYMBAL_VOL = 0.6;
const FADE_MS = 800;

type Layer = { el: HTMLAudioElement; target: number };

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
  el.play().catch(() => {});
  return { el, target };
}

export function startCrowd() {
  if (!isClient() || muted || handedOff) return;
  if (!crowd) {
    crowd = ensureLayer(crowd, crowdAsset.url, CROWD_TARGET);
    fade(crowd, CROWD_TARGET, FADE_MS);
  }
}

export function startDrumroll() {
  if (!isClient() || muted || handedOff) return;
  if (!drum) {
    drum = ensureLayer(drum, drumAsset.url, DRUM_TARGET);
    fade(drum, DRUM_TARGET, FADE_MS);
  }
}

/** Plays cymbal swell, fades out crowd + drumroll, ready for game-show music. */
export function climaxAndHandoff() {
  if (!isClient() || handedOff) return;
  handedOff = true;
  if (!muted) {
    const swell = new Audio(cymbalAsset.url);
    swell.volume = CYMBAL_VOL;
    swell.play().catch(() => {});
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
  for (const l of [crowd, drum]) {
    if (!l) continue;
    try {
      l.el.pause();
      l.el.currentTime = 0;
    } catch {}
  }
  crowd = null;
  drum = null;
}

export function setAmbienceMuted(v: boolean) {
  muted = v;
  if (v) stopAllAmbience();
}

/** Reset the handoff latch (e.g. when returning to lobby for a new game). */
export function resetAmbience() {
  handedOff = false;
}
