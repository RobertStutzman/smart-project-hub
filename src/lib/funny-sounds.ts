// Per-player funny sound effects.
// Each player is assigned one clip on join (server-side, per-room no-repeat
// shuffle stored on the player row). The same noise plays when their
// wrong-answer tile drops, the entire game.

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
import duckquack from "@/assets/audio/funny/duckquack.mp3.asset.json";
import goatscream from "@/assets/audio/funny/goatscream.mp3.asset.json";
import recordscratch from "@/assets/audio/funny/recordscratch.mp3.asset.json";
import partyhorn from "@/assets/audio/funny/partyhorn.mp3.asset.json";
import evillaugh from "@/assets/audio/funny/evillaugh.mp3.asset.json";
import donkeybray from "@/assets/audio/funny/donkeybray.mp3.asset.json";
import sneeze from "@/assets/audio/funny/sneeze.mp3.asset.json";
import burp from "@/assets/audio/funny/burp.mp3.asset.json";
import catmeow from "@/assets/audio/funny/catmeow.mp3.asset.json";
import dogbark from "@/assets/audio/funny/dogbark.mp3.asset.json";
import sheepbaa from "@/assets/audio/funny/sheepbaa.mp3.asset.json";
import wahwah from "@/assets/audio/funny/wahwah.mp3.asset.json";
import nooo from "@/assets/audio/funny/nooo.mp3.asset.json";
import snore from "@/assets/audio/funny/snore.mp3.asset.json";
import vineboom from "@/assets/audio/funny/vineboom.mp3.asset.json";

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
  { id: "duckquack", label: "Duck Quack", url: duckquack.url, volume: 0.95 },
  { id: "goatscream", label: "Goat Scream", url: goatscream.url, volume: 0.85 },
  { id: "recordscratch", label: "Record Scratch", url: recordscratch.url, volume: 0.9 },
  { id: "partyhorn", label: "Party Horn", url: partyhorn.url, volume: 0.95 },
  { id: "evillaugh", label: "Evil Laugh", url: evillaugh.url, volume: 0.9 },
  { id: "donkeybray", label: "Donkey Bray", url: donkeybray.url, volume: 0.9 },
  { id: "sneeze", label: "Sneeze", url: sneeze.url, volume: 0.95 },
  { id: "burp", label: "Burp", url: burp.url, volume: 0.95 },
  { id: "catmeow", label: "Cat Meow", url: catmeow.url, volume: 0.9 },
  { id: "dogbark", label: "Dog Bark", url: dogbark.url, volume: 0.9 },
  { id: "sheepbaa", label: "Sheep Baa", url: sheepbaa.url, volume: 0.9 },
  { id: "wahwah", label: "Wah Wah", url: wahwah.url, volume: 0.95 },
  { id: "nooo", label: "Dramatic NOOO", url: nooo.url, volume: 0.9 },
  { id: "snore", label: "Snore", url: snore.url, volume: 0.9 },
  { id: "vineboom", label: "Vine Boom", url: vineboom.url, volume: 0.95 },
];

const BANK_BY_ID: Record<string, FunnySound> = Object.fromEntries(
  FUNNY_BANK.map((c) => [c.id, c]),
);

// Stable string hash (FNV-1a 32-bit) → bank index. Used as a fallback when a
// player row predates the funny_sound_id column.
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

export function getFunnySoundById(soundId: string | null | undefined): FunnySound | null {
  if (!soundId) return null;
  return BANK_BY_ID[soundId] ?? null;
}

let muted = false;
export function setFunnyMuted(v: boolean) {
  muted = v;
}

const pool = new Map<string, HTMLAudioElement>();

function playClip(clip: FunnySound, opts?: { delayMs?: number; volume?: number }) {
  if (muted || typeof window === "undefined") return;
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

export function playFunnySoundForId(id: string, opts?: { delayMs?: number; volume?: number }) {
  if (!id) return;
  playClip(getFunnySoundForId(id), opts);
}

// Preferred: play by the server-assigned funny_sound_id. Falls back to the
// session-id hash if the stored id is missing or unknown (legacy rows).
export function playFunnySoundById(
  soundId: string | null | undefined,
  fallbackSessionId?: string,
  opts?: { delayMs?: number; volume?: number },
) {
  const clip = getFunnySoundById(soundId);
  if (clip) {
    playClip(clip, opts);
    return;
  }
  if (fallbackSessionId) playFunnySoundForId(fallbackSessionId, opts);
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
