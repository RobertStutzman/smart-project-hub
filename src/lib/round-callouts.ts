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

function roundNOpeners(n: number, q: number): string[] {
  return [
    `Round ${n} begins. Question ${q}.`,
    `Round ${n} kicks off. Question ${q}.`,
    `New round. Question ${q}. Stay sharp.`,
  ];
}

// --- Mid-round pools (Q2–Q4 within a round, absolute number spoken) ---

function midRoundLines(q: number): string[] {
  return [
    `Question ${q}.`,
    `Question ${q} coming in.`,
    `Onto question ${q}.`,
    `Next up — question ${q}.`,
    `Question ${q}. Lock in.`,
    `Here's question ${q}.`,
    `Question ${q}. Eyes up.`,
  ];
}

// --- Wildcard slot (Q5 of rounds 1–4, absolute number spoken) ---

function wildcardPrefixes(q: number): string[] {
  return [
    `Question ${q} — and it's a wildcard.`,
    `Final question of the round, and it's a wildcard.`,
    `Wildcard time. Question ${q}.`,
  ];
}

function wildcardLines(kind: WildcardKind, q: number): string[] {
  const tail = WILDCARD_TAIL[kind];
  return wildcardPrefixes(q).map((p) => `${p} ${tail}`);
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
    return pick(wildcardLines(wildcard, q), q);
  }

  // Round opener — Q1 of any round
  if (qInRound === 1) {
    const pool = roundIdx === 1 ? ROUND1_OPENERS : roundNOpeners(roundIdx, q);
    return pick(pool, q);
  }

  // Mid-round Q2–Q4 (absolute number spoken)
  return pick(midRoundLines(q), q);
}

/**
 * Every possible string getRoundCallout can produce. Used by
 * generatePersonaPack to bake the TTS once.
 */
export const ALL_ROUND_CALLOUTS: string[] = (() => {
  const out: string[] = [];
  // Round 1 opener (q=1)
  out.push(...ROUND1_OPENERS);
  // Round 2/3/4 openers (q = 6, 11, 16)
  for (let r = 2; r <= 4; r++) {
    const q = (r - 1) * 5 + 1;
    out.push(...roundNOpeners(r, q));
  }
  // Mid-round Q2–Q4 within each round → absolute q values
  for (let r = 1; r <= 4; r++) {
    for (let i = 2; i <= 4; i++) {
      const q = (r - 1) * 5 + i;
      out.push(...midRoundLines(q));
    }
  }
  // Wildcards — Q5 of each round (q = 5, 10, 15, 20) × kinds
  const kinds: WildcardKind[] = [
    "lightning",
    "double_or_nothing",
    "first_blood",
    "underdog",
    "saboteur",
    "glitch",
    "roast",
  ];
  for (let r = 1; r <= 4; r++) {
    const q = r * 5;
    for (const k of kinds) out.push(...wildcardLines(k, q));
  }
  // Static one-shots used outside the per-question flow but spoken every
  // game. Baking them turns ~6 ElevenLabs calls per game into free URL hits.
  out.push("Here we go.");
  out.push("Three.");
  out.push("Two.");
  out.push("One.");
  out.push("And now…");
  out.push("Final round. Winner takes all.");
  for (let r = 1; r <= 4; r++) {
    out.push(`Standings after round ${r}.`);
  }
  return out;
})();

