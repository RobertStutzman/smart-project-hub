// Web Audio synth-based sound engine — plus uploaded clip overrides per event.

export type Sfx =
  | "tap"
  | "whoosh"
  | "ignition"
  | "correct"
  | "wrong"
  | "drop"
  | "tick"
  | "tickHeavy"
  | "airhorn"
  | "crickets"
  | "boo"
  | "sadTrombone"
  | "shutterClose"
  | "shutterOpen";

export type GameEvent =
  | "lobby_music"
  | "round_intro"
  | "correct"
  | "wrong"
  | "reveal"
  | "leaderboard"
  | "final"
  | "victory";

let ctx: AudioContext | null = null;
let muted = false;

// Track music that was requested but couldn't start (autoplay blocked, etc).
// Replayed by retryBlockedMusic() after a user gesture.
let pendingMusicMode: "lobby" | "tense" | null = null;
let pendingMusicTempo = 480;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      (window.AudioContext as typeof AudioContext | undefined) ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext as typeof AudioContext | undefined);
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  if (v) {
    stopMusic();
    stopCreditsMusic(0);
    stopWagerBed(0);
    stopBootMusic(0);
  }
  // Mirror mute into ambience layer (lazy import to avoid cycle in SSR).
  if (typeof window !== "undefined") {
    void import("./ambience-engine").then((m) => m.setAmbienceMuted(v));
  }
}

export function isMuted() {
  return muted;
}

/**
 * Synchronously create (if needed) and resume the AudioContext.
 * Must be called from inside a user gesture handler to actually unlock playback.
 */
export function resumeAudioContext(): boolean {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const Ctor =
      (window.AudioContext as typeof AudioContext | undefined) ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext as typeof AudioContext | undefined);
    if (!Ctor) return false;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx.state === "running";
}

/**
 * Retry music playback that was previously blocked by autoplay.
 * Call from a user-gesture handler. No-op if nothing is pending or already playing.
 */
export function retryBlockedMusic(): void {
  if (typeof window === "undefined" || muted) return;
  if (!pendingMusicMode) return;
  // If a loop is already running, clear the pending flag.
  if (loopAudio && !loopAudio.paused) {
    pendingMusicMode = null;
    return;
  }
  const mode = pendingMusicMode;
  const tempo = pendingMusicTempo;
  pendingMusicMode = null;
  startMusic(mode, tempo);
}


// Transient gain multiplier applied to tone/sweep/noise. Set by play(sfx, scale)
// so audience-triggered synth SFX can sit under music/announcer without
// changing every existing call site.
let synthVolumeScale = 1;

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.2,
  startAt = 0,
) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + startAt;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * synthVolumeScale), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function sweep(
  from: number,
  to: number,
  duration: number,
  type: OscillatorType = "sawtooth",
  gain = 0.2,
) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * synthVolumeScale), t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(duration: number, gain = 0.15) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime;
  const buf = a.createBuffer(1, a.sampleRate * duration, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  const g = a.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(Math.max(0.0001, gain * synthVolumeScale), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g).connect(a.destination);
  src.start(t0);
}

export function play(sfx: Sfx, volumeScale = 1) {
  const prevScale = synthVolumeScale;
  synthVolumeScale = Math.max(0, volumeScale);
  try {
    playInner(sfx);
  } finally {
    synthVolumeScale = prevScale;
  }
}

function playInner(sfx: Sfx) {
  switch (sfx) {
    case "tap":
      tone(440, 0.05, "square", 0.05);
      break;
    case "whoosh":
      sweep(120, 1200, 0.28, "sawtooth", 0.07);
      break;
    case "ignition": {
      // Arena-style "press to start" stinger: bright riser + transient click
      // + sub-bass impact + shimmer tail. ~700ms total.
      sweep(600, 3200, 0.28, "sine", 0.18);
      window.setTimeout(() => noise(0.06, 0.22), 240);
      window.setTimeout(() => {
        sweep(90, 38, 0.45, "sine", 0.55);
        sweep(140, 60, 0.4, "triangle", 0.28);
      }, 260);
      window.setTimeout(() => sweep(1800, 900, 0.22, "triangle", 0.12), 320);
      break;
    }
      break;
    case "correct":
      tone(660, 0.1, "triangle", 0.22);
      tone(880, 0.18, "triangle", 0.22, 0.08);
      break;
    case "wrong":
      sweep(200, 60, 0.4, "square", 0.22);
      break;
    case "drop":
      sweep(800, 80, 0.6, "sawtooth", 0.25);
      break;
    case "tick": {
      // Warm wooden tock — pitched body + transient click. Lower and rounder
      // than a digital beep so the loop under the timer is unobtrusive.
      sweep(520, 360, 0.06, "triangle", 0.12);
      sweep(1800, 900, 0.018, "sine", 0.05);
      break;
    }
    case "tickHeavy": {
      // Heavier tock with a sub-bass thump for the final-question heartbeat.
      sweep(420, 280, 0.08, "triangle", 0.16);
      sweep(110, 55, 0.18, "sine", 0.32);
      break;
    }
    case "airhorn":
      tone(180, 0.5, "sawtooth", 0.3);
      tone(220, 0.5, "sawtooth", 0.25, 0.02);
      break;
    case "crickets":
      for (let i = 0; i < 6; i++) tone(4200, 0.04, "square", 0.08, i * 0.12);
      break;
    case "boo":
      noise(0.6, 0.18);
      sweep(220, 110, 0.6, "sawtooth", 0.18);
      break;
    case "sadTrombone": {
      const notes: Array<[number, number]> = [
        [311, 0.18],
        [277, 0.18],
        [247, 0.18],
        [196, 0.55],
      ];
      let t = 0;
      for (const [f, d] of notes) {
        sweep(f * 1.05, f * 0.92, d, "sawtooth", 0.22);
        t += d * 0.9;
        tone(f * 0.5, d * 0.8, "triangle", 0.08, t);
      }
      break;
    }
    case "shutterClose": {
      // Low sub-bass thump + filtered noise burst as the bands slam shut.
      sweep(180, 38, 0.45, "sine", 0.55);
      sweep(90, 22, 0.55, "triangle", 0.4);
      noise(0.35, 0.18);
      break;
    }
    case "shutterOpen": {
      // Bright metallic "shink" + soft noise sigh as bands retract.
      sweep(3200, 1100, 0.18, "triangle", 0.18);
      sweep(1800, 600, 0.22, "sine", 0.14);
      noise(0.25, 0.08);
      break;
    }
  }
}

// ─── Custom clip system ─────────────────────────────────────────────

type CustomClip = { url: string; volume: number; loop: boolean };

// Built-in default clips (CDN-hosted). Used when no admin-assigned clip
// exists for the slot. Keeps lobby/final feeling polished out of the box.
import lobbyTrivia from "@/assets/audio/music/lobby_trivia.mp3.asset.json";
import finalSting from "@/assets/audio/final/final_sting.mp3.asset.json";
import finalWagerBed from "@/assets/audio/final/final_wager_bed.mp3.asset.json";
import creditsOutro from "@/assets/audio/music/credits_outro.mp3.asset.json";
import bootSting from "@/assets/audio/music/boot_sting.mp3.asset.json";
import bootStationId from "@/assets/audio/voice/boot_station_id.mp3.asset.json";

const DEFAULT_EVENT_CLIPS: Partial<Record<GameEvent, CustomClip>> = {
  lobby_music: { url: lobbyTrivia.url, volume: 0.22, loop: true },
  final: { url: finalSting.url, volume: 0.95, loop: false },
};
// Final-round underscore bed (separate from the one-shot "final" sting).
export const FINAL_WAGER_BED_URL: string = finalWagerBed.url;
export const CREDITS_OUTRO_URL: string = creditsOutro.url;

// ─── Boot intro: one-shot music sting + voiced station ID ──────────
let bootMusicAudio: HTMLAudioElement | null = null;
let bootMusicBaseVol = 0.32;
let bootVoiceAudio: HTMLAudioElement | null = null;

/** Start the boot intro music sting (one-shot, ~9s). */
export function playBootMusic(volume = 0.32) {
  if (muted || typeof window === "undefined") return;
  stopBootMusic(0);
  stopOtherMusic("boot", 400);
  try {
    bootMusicAudio = new Audio(bootSting.url);
    bootMusicAudio.loop = false;
    const base = Math.max(0, Math.min(1, volume));
    bootMusicBaseVol = base;
    bootMusicAudio.volume = base;
    bootMusicAudio.play().catch(() => {});
  } catch {
    /* noop */
  }
}
/** Fade out + stop the boot intro music. */
export function stopBootMusic(fadeMs = 600) {
  const a = bootMusicAudio;
  bootMusicAudio = null;
  if (!a) return;
  if (fadeMs <= 0) {
    try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    return;
  }
  const startVol = a.volume;
  const steps = 14;
  let i = 0;
  const id = window.setInterval(() => {
    i++;
    a.volume = Math.max(0, startVol * (1 - i / steps));
    if (i >= steps) {
      window.clearInterval(id);
      try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    }
  }, Math.max(20, fadeMs / steps));
}
/** Play the voiced station ID over the boot music, auto-ducking the bed. */
export function playBootStationId(volume = 0.95) {
  if (muted || typeof window === "undefined") return;
  try {
    if (bootVoiceAudio) {
      bootVoiceAudio.pause();
    }
    bootVoiceAudio = new Audio(bootStationId.url);
    bootVoiceAudio.volume = Math.max(0, Math.min(1, volume));
    // Duck the music bed under the voice.
    if (bootMusicAudio) {
      bootMusicAudio.volume = bootMusicBaseVol * 0.38;
    }
    const restore = () => {
      if (bootMusicAudio) bootMusicAudio.volume = bootMusicBaseVol;
      bootVoiceAudio = null;
    };
    bootVoiceAudio.addEventListener("ended", restore, { once: true });
    bootVoiceAudio.addEventListener("error", restore, { once: true });
    bootVoiceAudio.play().catch(restore);
  } catch {
    /* noop */
  }
}


let creditsAudio: HTMLAudioElement | null = null;
let creditsBaseVol: number | null = null;
export function playCreditsMusic(volume = 0.32) {
  if (muted || typeof window === "undefined") return;
  const base = Math.max(0, Math.min(1, volume));
  // If the same track is already playing, just adjust volume — avoids
  // a stop+restart "blip" when recap hands off to credits.
  if (creditsAudio && !creditsAudio.paused && creditsAudio.src.endsWith(creditsOutro.url.split("/").pop() || "")) {
    creditsBaseVol = base;
    creditsAudio.volume = duckActive ? base * 0.35 : base;
    stopOtherMusic("credits", 450);
    return;
  }
  stopCreditsMusic(0);
  stopOtherMusic("credits", 450);
  try {
    creditsAudio = new Audio(creditsOutro.url);
    creditsAudio.loop = true;
    creditsBaseVol = base;
    creditsAudio.volume = duckActive ? base * 0.35 : base;
    creditsAudio.play().catch(() => {});
  } catch {
    /* noop */
  }
}
export function stopCreditsMusic(fadeMs = 800) {
  const a = creditsAudio;
  creditsAudio = null;
  if (!a) return;
  if (fadeMs <= 0) {
    try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    return;
  }
  const startVol = a.volume;
  const steps = 16;
  let i = 0;
  const id = window.setInterval(() => {
    i++;
    a.volume = Math.max(0, startVol * (1 - i / steps));
    if (i >= steps) {
      window.clearInterval(id);
      try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    }
  }, Math.max(20, fadeMs / steps));
}


let wagerBedAudio: HTMLAudioElement | null = null;
let wagerBaseVol: number | null = null;
export function playWagerBed(volume = 0.35) {
  if (muted || typeof window === "undefined") return;
  stopWagerBed();
  stopOtherMusic("wager", 450);
  try {
    wagerBedAudio = new Audio(finalWagerBed.url);
    wagerBedAudio.loop = true;
    const base = Math.max(0, Math.min(1, volume));
    wagerBaseVol = base;
    wagerBedAudio.volume = duckActive ? base * 0.35 : base;
    wagerBedAudio.play().catch(() => {});
  } catch {
    /* noop */
  }
}
export function stopWagerBed(fadeMs = 600) {
  const a = wagerBedAudio;
  wagerBedAudio = null;
  if (!a) return;
  const startVol = a.volume;
  const steps = 12;
  let i = 0;
  const id = window.setInterval(() => {
    i++;
    a.volume = Math.max(0, startVol * (1 - i / steps));
    if (i >= steps) {
      window.clearInterval(id);
      try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    }
  }, Math.max(20, fadeMs / steps));
}

const eventClips: Partial<Record<GameEvent, CustomClip>> = { ...DEFAULT_EVENT_CLIPS };
let loopAudio: HTMLAudioElement | null = null;
let currentLoopMode: "lobby" | "tense" | null = null;
let synthLoopTimer: number | null = null;
const stingPool = new Map<string, HTMLAudioElement>();

export function loadCustomEvents(
  events: Partial<Record<GameEvent, CustomClip>>,
) {
  for (const k of Object.keys(eventClips) as GameEvent[]) delete eventClips[k];
  // Re-apply defaults first so admin overrides win but missing slots fall back.
  Object.assign(eventClips, DEFAULT_EVENT_CLIPS, events);
}

function stopLoopAudio() {
  if (loopAudio) {
    loopAudio.pause();
    loopAudio.currentTime = 0;
    loopAudio = null;
  }
  if (synthLoopTimer !== null) {
    window.clearInterval(synthLoopTimer);
    synthLoopTimer = null;
  }
  currentLoopMode = null;
  pendingMusicMode = null;
}

/** Start lobby/tense background music. Uses uploaded clip for lobby_music if assigned. */
export function startMusic(mode: "lobby" | "tense", tempoMs = 480) {
  stopLoopAudio();
  stopOtherMusic("loop", 450);
  if (muted) return;
  currentLoopMode = mode;

  if (mode === "lobby") {
    const clip = eventClips.lobby_music;
    if (clip) {
      if (typeof window === "undefined") return;
      loopAudio = new Audio(clip.url);
      loopAudio.loop = clip.loop;
      const base = Math.max(0, Math.min(1, clip.volume));
      loopAudio.volume = Math.min(base, 0.25) * (duckActive ? 0.25 : 1);
      const playPromise = loopAudio.play();
      // Remember intent so retryBlockedMusic() can resume after a gesture.
      pendingMusicMode = mode;
      pendingMusicTempo = tempoMs;
      playPromise
        .then(() => {
          pendingMusicMode = null;
        })
        .catch(() => {
          // Autoplay blocked — leave pendingMusicMode set so a later
          // user gesture can retry via retryBlockedMusic().
        });
      return;
    }
  }

  const lobby = [261.63, 329.63, 392, 523.25];
  const tense = [196, 233.08, 261.63, 311.13];
  const notes = mode === "lobby" ? lobby : tense;
  let i = 0;
  const tick = () => {
    if (muted || currentLoopMode !== mode) return;
    // much quieter synth bed so voice sits on top
    const g = (mode === "lobby" ? 0.04 : 0.05) * (duckActive ? 0.3 : 1);
    tone(notes[i % notes.length], 0.18, mode === "lobby" ? "triangle" : "square", g);
    i++;
  };
  tick();
  synthLoopTimer = window.setInterval(tick, tempoMs);
}

let duckActive = false;
/** Temporarily lower all background music (loop, credits, wager bed) under voice/TTS. */
export function duckMusic(on: boolean) {
  duckActive = on;
  if (loopAudio) {
    loopAudio.volume = on ? 0.06 : 0.22;
  }
  if (creditsAudio) {
    const base = creditsBaseVol ?? 0.32;
    creditsAudio.volume = on ? base * 0.35 : base;
  }
  if (wagerBedAudio) {
    const base = wagerBaseVol ?? 0.32;
    wagerBedAudio.volume = on ? base * 0.35 : base;
  }
}

export function stopMusic() {
  stopLoopAudio();
}

/**
 * Hard-stop every non-ambience audio surface owned by this engine.
 * Use at room-reset boundaries (end game → new room) so credits music,
 * wager bed, loop music, pooled stings, and in-flight funny sounds can't
 * bleed into the new lobby.
 */
export function silenceAllAudio() {
  stopLoopAudio();
  stopCreditsMusic(0);
  stopWagerBed(0);
  // Pooled one-shot stings (audience soundboard) — pause any still playing.
  for (const a of stingPool.values()) {
    try { a.pause(); a.currentTime = 0; } catch { /* ignore */ }
  }
  // Funny-sound pool lives in a separate module; silence via dynamic import.
  if (typeof window !== "undefined") {
    void import("./funny-sounds").then((m) => m.stopAllFunnySounds?.()).catch(() => {});
  }
}

/** Fire a one-shot event clip if uploaded; otherwise fall back to a synth SFX. */
export function playEvent(event: GameEvent) {
  if (muted) return;
  const clip = eventClips[event];
  if (clip && typeof window !== "undefined") {
    const audio = new Audio(clip.url);
    audio.volume = Math.max(0, Math.min(1, clip.volume));
    audio.play().catch(() => {});
    return;
  }
  // Fallback synth tones per event
  switch (event) {
    case "round_intro":
      play("whoosh");
      break;
    case "correct":
      play("correct");
      break;
    case "wrong":
      play("wrong");
      break;
    case "reveal":
      play("whoosh");
      break;
    case "leaderboard":
      tone(523, 0.12, "triangle", 0.2);
      tone(659, 0.18, "triangle", 0.2, 0.1);
      break;
    case "final":
      sweep(180, 90, 0.8, "sawtooth", 0.28);
      break;
    case "victory":
      tone(523, 0.15, "triangle", 0.25);
      tone(659, 0.15, "triangle", 0.25, 0.12);
      tone(784, 0.3, "triangle", 0.25, 0.24);
      break;
    case "lobby_music":
      break;
  }
}

/** Play an arbitrary uploaded clip by URL (used by audience soundboard). */
export function playClipUrl(url: string, volume = 1, cacheKey?: string) {
  if (muted || typeof window === "undefined") return;
  let audio: HTMLAudioElement;
  if (cacheKey && stingPool.has(cacheKey)) {
    audio = stingPool.get(cacheKey)!;
    audio.currentTime = 0;
  } else {
    audio = new Audio(url);
    if (cacheKey) stingPool.set(cacheKey, audio);
  }
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.play().catch(() => {});
}

// ─── Drop SFX bank ─────────────────────────────────────────────────
// Randomized "answer tile dropped" sound — heavy thuds appear more often
// than cartoon takes for variety without leaning slapstick.

import dropThud from "@/assets/audio/drop-thud.mp3.asset.json";
import dropGlass from "@/assets/audio/drop-glass.mp3.asset.json";
import dropTrapdoor from "@/assets/audio/drop-trapdoor.mp3.asset.json";
import dropAnvil from "@/assets/audio/drop-anvil.mp3.asset.json";
import dropSplash from "@/assets/audio/drop-splash.mp3.asset.json";
import dropElectric from "@/assets/audio/drop-electric.mp3.asset.json";

type DropClip = { url: string; weight: number; volume: number };
const DROP_BANK: DropClip[] = [
  { url: dropThud.url, weight: 3, volume: 0.9 },
  { url: dropGlass.url, weight: 3, volume: 0.85 },
  { url: dropTrapdoor.url, weight: 3, volume: 0.9 },
  { url: dropElectric.url, weight: 2, volume: 0.8 },
  { url: dropAnvil.url, weight: 1, volume: 0.85 },
  { url: dropSplash.url, weight: 1, volume: 0.85 },
];
let lastDropUrl: string | null = null;

export function playRandomDrop() {
  if (muted || typeof window === "undefined") {
    play("drop");
    return;
  }
  const pool = DROP_BANK.filter((c) => c.url !== lastDropUrl);
  const choices = pool.length > 0 ? pool : DROP_BANK;
  const total = choices.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  let pick = choices[0];
  for (const c of choices) {
    r -= c.weight;
    if (r <= 0) {
      pick = c;
      break;
    }
  }
  lastDropUrl = pick.url;
  try {
    const audio = new Audio(pick.url);
    audio.volume = pick.volume;
    audio.play().catch(() => play("drop"));
  } catch {
    play("drop");
  }
}

// ─── Adaptive timer-driven intensity ───────────────────────────────
// A persistent low rumble + filtered noise bed that ramps with `intensity`
// (0..1, where 1 = timer nearly out). Lives independently of the music loop
// so it works whether the tense synth loop or an uploaded bed is playing.

type IntensityNodes = {
  rumbleOsc: OscillatorNode;
  rumbleGain: GainNode;
  subOsc: OscillatorNode;
  subGain: GainNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
};
let intensityNodes: IntensityNodes | null = null;

function ensureIntensityNodes(a: AudioContext): IntensityNodes {
  if (intensityNodes) return intensityNodes;
  const t0 = a.currentTime;

  const rumbleOsc = a.createOscillator();
  rumbleOsc.type = "sawtooth";
  rumbleOsc.frequency.setValueAtTime(48, t0);
  const rumbleGain = a.createGain();
  rumbleGain.gain.setValueAtTime(0, t0);
  rumbleOsc.connect(rumbleGain).connect(a.destination);
  rumbleOsc.start(t0);

  const subOsc = a.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(36, t0);
  const subGain = a.createGain();
  subGain.gain.setValueAtTime(0, t0);
  subOsc.connect(subGain).connect(a.destination);
  subOsc.start(t0);

  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noiseSrc = a.createBufferSource();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;
  const noiseFilter = a.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(220, t0);
  noiseFilter.Q.setValueAtTime(0.7, t0);
  const noiseGain = a.createGain();
  noiseGain.gain.setValueAtTime(0, t0);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(a.destination);
  noiseSrc.start(t0);

  intensityNodes = { rumbleOsc, rumbleGain, subOsc, subGain, noiseFilter, noiseGain };
  return intensityNodes;
}

/**
 * Adaptive music intensity is intentionally disabled — the rumble/sub/noise
 * bed it produced was reported as an "annoying hum" that swelled under
 * questions. We keep the function (and all call sites) as a no-op so the
 * engine surface area is unchanged.
 */
export function setMusicIntensity(_intensity: number) {
  return;
}

// ─── Per-player walk-on stinger (synth, ~0.4s, ducked under VO) ────
export type WalkOnVariant = "riser" | "brass" | "blip" | "scratch";
const WALK_ON_VARIANTS: WalkOnVariant[] = ["riser", "brass", "blip", "scratch"];

export function playWalkOnStinger(indexOrVariant: number | WalkOnVariant = 0) {
  if (muted) return;
  const v: WalkOnVariant =
    typeof indexOrVariant === "string"
      ? indexOrVariant
      : WALK_ON_VARIANTS[((indexOrVariant % WALK_ON_VARIANTS.length) + WALK_ON_VARIANTS.length) % WALK_ON_VARIANTS.length];
  const s = 0.7;
  switch (v) {
    case "riser":
      sweep(220, 980, 0.36, "sawtooth", 0.14 * s);
      tone(1320, 0.08, "triangle", 0.16 * s, 0.3);
      break;
    case "brass":
      tone(330, 0.18, "sawtooth", 0.22 * s);
      tone(440, 0.22, "sawtooth", 0.18 * s, 0.03);
      tone(660, 0.18, "triangle", 0.14 * s, 0.06);
      break;
    case "blip":
      tone(880, 0.06, "square", 0.16 * s);
      tone(1320, 0.07, "square", 0.14 * s, 0.07);
      tone(1760, 0.08, "square", 0.12 * s, 0.14);
      break;
    case "scratch":
      sweep(2400, 320, 0.16, "sawtooth", 0.14 * s);
      noise(0.12, 0.08 * s);
      break;
  }
}


// ─── End-game music pileup guard ─────────────────────────────────
// At stage boundaries (final wager → reveal → credits) we'd sometimes get
// 2–3 music beds layered on top of each other ("4 songs playing at once").
// `stopOtherMusic(except)` cross-fades every other bed out so only one
// concurrent music surface ever plays. Called by each music starter below.
export type MusicBed = "loop" | "credits" | "wager" | "boot";
export function stopOtherMusic(except: MusicBed, fadeMs = 450) {
  if (except !== "loop") stopLoopAudio();
  if (except !== "credits") stopCreditsMusic(fadeMs);
  if (except !== "wager") stopWagerBed(fadeMs);
  if (except !== "boot") stopBootMusic(fadeMs);
}

// Stop ALL audio when the host tab is hidden or the page is being unloaded.
// Firestick browsers in particular keep audio playing after the user backs
// out unless we silence on visibilitychange.
if (typeof window !== "undefined") {
  const hardStop = () => {
    try {
      silenceAllAudio();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pagehide", hardStop);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hardStop();
  });
}



