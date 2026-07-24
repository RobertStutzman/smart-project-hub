// Extra round/wildcard callout pools. Merged into round-callouts.ts at
// module load so every string appears in ALL_ROUND_CALLOUTS and gets
// pre-baked by generatePersonaPack.

import type { WildcardKind } from "./round-callouts";

const EXTRA_ROUND_OPENERS_R1 = [
  "Round one. Freshly caffeinated. Freshly doomed.",
  "First round of the night. Warm up, then get destroyed.",
  "Round one — welcome to the deep end.",
  "Round one begins. No warning shots.",
];

function extraRoundOpeners(n: number, q: number): string[] {
  return [
    `Round ${n}, question ${q}. Bring it.`,
    `Round ${n} lights up. Question ${q} incoming.`,
    `Round ${n}. Question ${q}. Try harder than last time.`,
    `Round ${n} rolls. Question ${q}. Focus.`,
  ];
}

function extraMidRound(q: number): string[] {
  return [
    `Question ${q}. No pressure.`,
    `Question ${q} — try not to blink.`,
    `Question ${q} inbound.`,
    `Here's ${q}. Read it twice.`,
    `Question ${q} on deck.`,
    `Question ${q}. Lock a lane.`,
    `Number ${q}. Send it.`,
    `Question ${q}. Live one.`,
  ];
}

const EXTRA_WILDCARD_TAILS: Record<WildcardKind, string[]> = {
  lightning: [
    "Lightning round! Eight seconds, double points, no mercy.",
    "Lightning round — clock's short, stakes are double.",
    "Lightning round! Speed pays. Hesitation costs.",
  ],
  double_or_nothing: [
    "Double or Nothing. Right doubles you. Wrong empties you.",
    "Double or Nothing — no middle ground.",
    "Double or Nothing. Big swing, big consequences.",
  ],
  first_blood: [
    "First Blood! Fastest correct wins the whole thing.",
    "First Blood — one winner, no runners-up.",
    "First Blood! Speed is the only currency here.",
  ],
  underdog: [
    "Underdog boost! Last place plays for double.",
    "Underdog round — cellar dweller gets a rocket.",
    "Underdog boost active. Bottom of the board, this is your moment.",
  ],
  saboteur: [
    "Saboteur round! One of you is lying. Good luck.",
    "Saboteur round — trust nobody, especially the confident one.",
    "Saboteur round! Truth is optional. Chaos is mandatory.",
  ],
  glitch: [
    "Glitch round! The rules just left. Send help.",
    "Glitch round — things go sideways. Enjoy.",
    "Glitch round! Reality bends. Answers might too.",
  ],
  roast: [
    "Roast vote! Pick a victim. Politely.",
    "Roast round — vote with your worst instincts.",
    "Roast vote! Choose your target. Sleep on it later.",
  ],
};

function extraWildcardLines(kind: WildcardKind, q: number): string[] {
  return EXTRA_WILDCARD_TAILS[kind].flatMap((tail) => [
    `Question ${q}. Wildcard. ${tail}`,
    `Wildcard slot. Question ${q}. ${tail}`,
    `Curveball on ${q} — ${tail}`,
  ]);
}

const EXTRA_STANDINGS = [
  "Standings shift. Egos wobble.",
  "Board update. Some of you are climbing. Some of you aren't.",
  "Leaderboard talks. Try to listen.",
  "Check the board. Adjust your ambition.",
  "Standings breathe. Pressure rises.",
];

const EXTRA_FINAL_INTROS = [
  "Final round. Standings mean nothing. Wagers mean everything.",
  "Final drop. All chips on the table.",
  "This is the last one. Aim true.",
  "One question left in the whole show. Make it count.",
];

/**
 * Every extra string we want the persona baker to bake. Concatenated into
 * ALL_ROUND_CALLOUTS by round-callouts.ts.
 */
export const EXTRA_ROUND_CALLOUTS: string[] = (() => {
  const out: string[] = [];
  out.push(...EXTRA_ROUND_OPENERS_R1);
  for (let r = 2; r <= 4; r++) {
    const q = (r - 1) * 5 + 1;
    out.push(...extraRoundOpeners(r, q));
  }
  for (let r = 1; r <= 4; r++) {
    for (let i = 2; i <= 4; i++) {
      const q = (r - 1) * 5 + i;
      out.push(...extraMidRound(q));
    }
  }
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
    for (const k of kinds) out.push(...extraWildcardLines(k, q));
  }
  out.push(...EXTRA_STANDINGS);
  out.push(...EXTRA_FINAL_INTROS);
  return out;
})();
