// Round / question announcements spoken by the host between questions.
//
// Game shape: 4 rounds × 5 questions + final = 21 questions.
// The 5th question of rounds 1–4 is the wildcard (lightning, etc.).
// Q21 (final) is handled separately via the final_intro / final_hype path.
//
// Every string produced here is also enumerated in ALL_ROUND_CALLOUTS so
// the persona-pack baker can pre-generate the TTS once and replay from
// the cache forever after.

export type WildcardKind =
  | "lightning"
  | "double_or_nothing"
  | "first_blood"
  | "underdog"
  | "saboteur"
  | "glitch"
  | "roast";

export const WILDCARD_TAIL: Record<WildcardKind, string> = {
  lightning: "Lightning round! Eight seconds, double points!",
  double_or_nothing: "Double or Nothing! Right doubles, wrong costs you.",
  first_blood: "First Blood! Only the fastest correct answer scores.",
  underdog: "Underdog boost! Last place plays for double.",
  saboteur: "Saboteur round! Trust no one.",
  glitch: "Glitch round! Things are about to get weird.",
  roast: "Roast vote! Pick your victim.",
};

// --- Round opener pools (Q1 of each round) ---

const ROUND1_OPENERS = [
  "Round 1. Question 1. Here we go.",
  "Game on. Round 1, question 1.",
  "Round one. First question. Don't choke.",
];

function roundNOpeners(n: number): string[] {
  return [
    `Round ${n}. Question 1.`,
    `Round ${n} kicks off. Question 1.`,
    `New round. Question 1. Stay sharp.`,
  ];
}

// --- Mid-round pools (Q2–Q4) ---

function midRoundLines(n: number): string[] {
  return [
    `Question ${n}.`,
    `Question ${n} coming in.`,
    `Onto question ${n}.`,
    `Next up — question ${n}.`,
    `Question ${n}. Lock in.`,
    `Here's question ${n}.`,
    `Question ${n}. Eyes up.`,
  ];
}

// --- Wildcard slot (Q5 of rounds 1–4) ---

const WILDCARD_PREFIXES = [
  "Question 5 — and it's a wildcard.",
  "Final question of the round, and it's a wildcard.",
  "Wildcard time. Question 5.",
];

function wildcardLines(kind: WildcardKind): string[] {
  const tail = WILDCARD_TAIL[kind];
  return WILDCARD_PREFIXES.map((p) => `${p} ${tail}`);
}

// --- Deterministic picker ---

function pick<T>(pool: T[], seed: number): T {
  if (pool.length === 0) throw new Error("empty pool");
  const idx = ((seed % pool.length) + pool.length) % pool.length;
  return pool[idx];
}

export interface RoundCalloutInput {
  /** Absolute question index 1..21 (room.round_number). */
  questionNumber: number;
  /** Active wildcard for this question, if any. */
  wildcard: WildcardKind | null | undefined;
}

/**
 * Returns the line the host should say at the start of this question,
 * or null if no announcement is appropriate (e.g. final question — handled
 * by the final_intro path).
 */
export function getRoundCallout({
  questionNumber: q,
  wildcard,
}: RoundCalloutInput): string | null {
  if (q <= 0 || q >= 21) return null;
  const qInRound = ((q - 1) % 5) + 1;
  const roundIdx = Math.ceil(q / 5);

  // Wildcard slot — Q5 of any non-final round
  if (qInRound === 5 && wildcard) {
    return pick(wildcardLines(wildcard), q);
  }

  // Round opener — Q1 of any round
  if (qInRound === 1) {
    const pool = roundIdx === 1 ? ROUND1_OPENERS : roundNOpeners(roundIdx);
    return pick(pool, q);
  }

  // Mid-round Q2–Q4
  return pick(midRoundLines(qInRound), q);
}

/**
 * Every possible string getRoundCallout can produce. Used by
 * generatePersonaPack to bake the TTS once.
 */
export const ALL_ROUND_CALLOUTS: string[] = (() => {
  const out: string[] = [];
  // Openers
  out.push(...ROUND1_OPENERS);
  for (let r = 2; r <= 4; r++) out.push(...roundNOpeners(r));
  // Mid-round Q2–Q4
  for (let n = 2; n <= 4; n++) out.push(...midRoundLines(n));
  // Wildcards
  const kinds: WildcardKind[] = [
    "lightning",
    "double_or_nothing",
    "first_blood",
    "underdog",
    "saboteur",
    "glitch",
    "roast",
  ];
  for (const k of kinds) out.push(...wildcardLines(k));
  return out;
})();
