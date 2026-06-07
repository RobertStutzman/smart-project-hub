// Per-player funny sound effects.
// Each player is deterministically assigned one clip from the bank based on
// their session id, so the same player gets the same goofy noise the entire
// game. The noise plays when their wrong-answer tile drops.

import fart from "@/assets/audio/funny/fart.mp3.asset.json";
import scream from "@/assets/audio/funny/scream.mp3.asset.json";
import sadhorn from "@/assets/audio/funny/sadhorn.mp3.asset.json";
import boing from "@/assets/audio/funny/boing.mp3.asset.json";
import slipwhistle from "@/assets/audio/funny/slipwhistle.mp3.asset.json";
import goofyyell from "@/assets/audio/funny/goofyyell.mp3.asset.json";
import cuckoo from "@/assets/audio/funny/cuckoo.mp3.asset.json";
import buzzer from "@/assets/audio/funny/buzzer.mp3.asset.json";
import kazoo from "@/assets/audio/funny/kazoo.mp3.asset.json";
import baby from "@/assets/audio/funny/baby.mp3.asset.json";

export type FunnySound = {
  id: string;
  label: string;
  url: string;
  volume: number;
};

export const FUNNY_BANK: FunnySound[] = [
  { id: "fart", label: "Fart", url: fart.url, volume: 0.95 },
  { id: "scream", label: "Scream", url: scream.url, volume: 0.85 },
  { id: "sadhorn", label: "Sad Trombone", url: sadhorn.url, volume: 0.95 },
  { id: "boing", label: "Boing", url: boing.url, volume: 0.95 },
  { id: "slipwhistle", label: "Slide Whistle", url: slipwhistle.url, volume: 0.9 },
  { id: "goofyyell", label: "Goofy Yell", url: goofyyell.url, volume: 0.9 },
  { id: "cuckoo", label: "Cuckoo", url: cuckoo.url, volume: 0.9 },
  { id: "buzzer", label: "Buzzer", url: buzzer.url, volume: 0.9 },
  { id: "kazoo", label: "Sad Kazoo", url: kazoo.url, volume: 0.95 },
  { id: "baby", label: "Crying Baby", url: baby.url, volume: 0.85 },
];

// Stable string hash (FNV-1a 32-bit) → bank index.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function getFunnySoundForId(id: string): FunnySound {
  if (!id) return FUNNY_BANK[0];
  return FUNNY_BANK[hashStr(id) % FUNNY_BANK.length];
}

let muted = false;
export function setFunnyMuted(v: boolean) {
  muted = v;
}

const pool = new Map<string, HTMLAudioElement>();

export function playFunnySoundForId(id: string, opts?: { delayMs?: number; volume?: number }) {
  if (muted || typeof window === "undefined" || !id) return;
  const clip = getFunnySoundForId(id);
  const fire = () => {
    try {
      let audio = pool.get(clip.url);
      if (!audio) {
        audio = new Audio(clip.url);
        pool.set(clip.url, audio);
      }
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, opts?.volume ?? clip.volume));
      audio.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };
  if (opts?.delayMs && opts.delayMs > 0) {
    window.setTimeout(fire, opts.delayMs);
  } else {
    fire();
  }
}

// Preload all clips so the first play is instant.
export function preloadFunnyBank() {
  if (typeof window === "undefined") return;
  for (const clip of FUNNY_BANK) {
    if (!pool.has(clip.url)) {
      const a = new Audio(clip.url);
      a.preload = "auto";
      pool.set(clip.url, a);
    }
  }
}
