// Web Audio synth-based sound engine — plus uploaded clip overrides per event.

export type Sfx =
  | "tap"
  | "whoosh"
  | "correct"
  | "wrong"
  | "drop"
  | "tick"
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
  if (v) stopMusic();
}

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
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
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
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
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
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g).connect(a.destination);
  src.start(t0);
}

export function play(sfx: Sfx) {
  switch (sfx) {
    case "tap":
      tone(440, 0.05, "square", 0.12);
      break;
    case "whoosh":
      sweep(120, 1200, 0.4, "sawtooth", 0.18);
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
    case "tick":
      tone(1200, 0.04, "square", 0.1);
      break;
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
const eventClips: Partial<Record<GameEvent, CustomClip>> = {};
let loopAudio: HTMLAudioElement | null = null;
let currentLoopMode: "lobby" | "tense" | null = null;
let synthLoopTimer: number | null = null;
const stingPool = new Map<string, HTMLAudioElement>();

export function loadCustomEvents(
  events: Partial<Record<GameEvent, CustomClip>>,
) {
  for (const k of Object.keys(eventClips) as GameEvent[]) delete eventClips[k];
  Object.assign(eventClips, events);
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
}

/** Start lobby/tense background music. Uses uploaded clip for lobby_music if assigned. */
export function startMusic(mode: "lobby" | "tense", tempoMs = 480) {
  stopLoopAudio();
  if (muted) return;
  currentLoopMode = mode;

  if (mode === "lobby") {
    const clip = eventClips.lobby_music;
    if (clip) {
      if (typeof window === "undefined") return;
      loopAudio = new Audio(clip.url);
      loopAudio.loop = clip.loop;
      // Cap music well below voice so announcer/TTS is always intelligible.
      const base = Math.max(0, Math.min(1, clip.volume));
      loopAudio.volume = Math.min(base, 0.25) * (duckActive ? 0.25 : 1);
      loopAudio.play().catch(() => {});
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
/** Temporarily lower the background music so voice/TTS is clear. */
export function duckMusic(on: boolean) {
  duckActive = on;
  if (loopAudio) {
    loopAudio.volume = on ? 0.06 : 0.22;
  }
}

export function stopMusic() {
  stopLoopAudio();
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
