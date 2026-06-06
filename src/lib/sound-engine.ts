// Web Audio synth-based sound engine — no asset files needed.
// All sounds are generated programmatically for instant, zero-fetch playback.

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
  | "sadTrombone";

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
      // Wah-wah-wah-waaah
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
        // schedule next via setTimeout-style using startAt on tone
        tone(f * 0.5, d * 0.8, "triangle", 0.08, t);
      }
      break;
    }
  }
}

// Background music — simple looping arpeggio per state.
let loopTimer: number | null = null;
let currentLoop: "lobby" | "tense" | null = null;

export function startMusic(mode: "lobby" | "tense", tempoMs = 480) {
  stopMusic();
  if (muted) return;
  currentLoop = mode;
  const lobby = [261.63, 329.63, 392, 523.25];
  const tense = [196, 233.08, 261.63, 311.13];
  const notes = mode === "lobby" ? lobby : tense;
  let i = 0;
  const tick = () => {
    if (muted || currentLoop !== mode) return;
    tone(notes[i % notes.length], 0.18, mode === "lobby" ? "triangle" : "square", 0.1);
    i++;
  };
  tick();
  loopTimer = window.setInterval(tick, tempoMs);
}

export function stopMusic() {
  currentLoop = null;
  if (loopTimer !== null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
}
