// Host persona — "Vox", the in-game emcee.
// Catchphrases used by HostGameStage to react to game moments.
// Lines are intentionally short so the browser speechSynthesis voice
// (or a pre-baked TTS file) reads them in under ~3 seconds.

export const HOST_NAME = "Vox";

type Moment =
  | "intro_hype"        // cold open, after title card
  | "all_correct"       // entire room got it
  | "all_wrong"         // entire room whiffed
  | "split_correct"     // some right, some wrong
  | "first_blood"       // first to lock and correct
  | "streak_milestone"  // 3+/5+/7+ streak
  | "elimination"       // wrong answer dropped
  | "leader_changed"    // new #1 on leaderboard
  | "final_hype"        // entering final round
  | "credits_open";     // outro credits start

const LINES: Record<Moment, string[]> = {
  intro_hype: [
    "Buckle up. The drop is coming.",
    "Fingers on buzzers. Egos at the door.",
    "Let's find out who actually paid attention in school.",
  ],
  all_correct: [
    "Look at you, all of you, correct. Suspicious.",
    "A clean sweep. The category was too kind.",
    "Everybody right? Boring. Next one's harder.",
  ],
  all_wrong: [
    "Oof. Not a single one. Painful.",
    "Zero for the room. I'm secondhand embarrassed.",
    "Wow. Just... wow. Moving on.",
  ],
  split_correct: [
    "Half of you guessed. The other half KNEW.",
    "The room is split. Drama.",
    "Some hits, some misses. That's a game.",
  ],
  first_blood: [
    "First in, dead on. Showoff.",
    "Lock that in, you cocky genius.",
    "Fastest finger, sharpest brain. Rude.",
  ],
  streak_milestone: [
    "Somebody's on fire over here.",
    "Three in a row. Calm down, champ.",
    "Stop. Let someone else feel things.",
  ],
  elimination: [
    "And another one bites the drop.",
    "Wrong. Try faster next time.",
    "That was a guess, wasn't it.",
  ],
  leader_changed: [
    "New leader! The throne is wobbly.",
    "Coup at the top of the board.",
    "Watch yourself, last round's winner.",
  ],
  final_hype: [
    "This. Is. The Final Drop. Bet big or go home small.",
    "One question. Everything on the table. Try not to cry.",
    "Final round. The standings mean nothing now.",
  ],
  credits_open: [
    "And that's the show. Roll credits.",
    "Game over. Survivors, please bow.",
    "Take a bow, contestants. Or don't, last place.",
  ],
};

/** Pick a deterministic-feeling line for a moment, with seed for variety. */
export function pickLine(moment: Moment, seed: string | number = Date.now()): string {
  const pool = LINES[moment];
  const s = typeof seed === "string" ? seed.length + seed.charCodeAt(0) : Math.floor(seed);
  return pool[Math.abs(s) % pool.length];
}

/** Speak a persona line using the browser's speechSynthesis. */
export function speakPersona(text: string, opts?: { rate?: number; pitch?: number; volume?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts?.rate ?? 1.05;
    u.pitch = opts?.pitch ?? 1.0;
    u.volume = opts?.volume ?? 1.0;
    // Don't cancel in-flight speech that the question-read pipeline is using;
    // simply queue this line behind it.
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
