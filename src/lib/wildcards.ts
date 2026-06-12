// Shared wildcard helpers — used on host, player and server.

export type Wildcard =
  | "lightning"
  | "double_or_nothing"
  | "first_blood"
  | "underdog"
  | "saboteur"
  | "glitch"
  | "roast"
  | "sudden_drop"
  | "mirror"
  | "heist"
  | "blackout";

/** Full deck — per-game we shuffle and deal first 4 into Q5/10/15/20. */
export const WILDCARD_DECK: Wildcard[] = [
  "lightning",
  "double_or_nothing",
  "first_blood",
  "underdog",
  "saboteur",
  "glitch",
  "roast",
  "sudden_drop",
  "mirror",
  "heist",
  "blackout",
];

/** Pre-question announcer explainer lines. One picked randomly per round. */
export const WILDCARD_EXPLAINERS: Record<Wildcard, string[]> = {
  lightning: [
    "Lightning round! Eight seconds on the clock and double the points. Move fast.",
    "Lightning strikes — answers go up, the clock goes down. Eight seconds, double points.",
  ],
  double_or_nothing: [
    "Double or Nothing. Get it right, your points double. Get it wrong, you lose a hundred and fifty.",
    "Double or Nothing! Big reward, real penalty. Only lock in if you're sure.",
  ],
  first_blood: [
    "First Blood. Only the fastest correct answer scores anything. Don't think — strike.",
    "First Blood round. The quickest right answer takes the points. Everyone else gets nothing.",
  ],
  underdog: [
    "Underdog round. Whoever is in last place plays for double points. Time to make a move.",
    "Underdog Boost — the player at the bottom of the board gets double if they nail it.",
  ],
  saboteur: [
    "Saboteur Round! One of you was secretly shown the WRONG answer. Trust no one.",
    "Saboteur! One player among you is lying. Pick wrong, and they cash in. Choose carefully.",
  ],
  glitch: [
    "Glitch Round! The tiles are about to get weird. Hold steady and lock it in.",
    "Warning — glitch detected. Don't panic when the answers start dancing.",
  ],
  roast: [
    "Roast Vote! No right answer here — just vote for the player who fits the prompt best.",
    "Time to roast. Read the prompt, pick a player. The most-voted name wins five hundred.",
  ],
  sudden_drop: [
    "Sudden Drop! Only two answers, twelve seconds, one and a half times the points. Coin flip — go.",
    "Sudden Drop round. We've eliminated two answers already. Pick the right one of the two.",
  ],
  mirror: [
    "Mirror Round! The letter labels are scrambled. Read the answers, not the letters.",
    "Mirror Round — A, B, C, D are out of order. Focus on the words, not the badge.",
  ],
  heist: [
    "Heist Round! Get this right and you steal fifty points from whoever's leading.",
    "Heist! A correct answer robs the leader of fifty points. Crown them or knock them down.",
  ],
  blackout: [
    "Blackout Round! The question stays hidden — listen carefully, then lock it in.",
    "Blackout. You won't see the question for five seconds — your ears do the work.",
  ],
};

export function pickExplainer(w: Wildcard): string {
  const lines = WILDCARD_EXPLAINERS[w] ?? [];
  if (lines.length === 0) return "";
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Deterministic Fisher-Yates from a string seed. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deck for a given room — shuffled once per game from the room id. */
export function wildcardDeckForRoom(roomId: string): Wildcard[] {
  return seededShuffle(WILDCARD_DECK, roomId);
}

/** Mirror round: deterministic A/B/C/D permutation derived from question seed. */
export function mirrorLetters(seed: string | null | undefined): [string, string, string, string] {
  const base = ["A", "B", "C", "D"];
  if (!seed) return base as [string, string, string, string];
  const shuffled = seededShuffle(base, `mirror:${seed}`);
  return shuffled as [string, string, string, string];
}
