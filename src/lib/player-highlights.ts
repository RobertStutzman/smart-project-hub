// Per-player best/worst caption derivation for the credits highlight reel.
// Also exposes short Vox one-liners that match each caption category, so the
// announcer can riff on the same beat as the on-screen caption.

export type HighlightPlayer = {
  nickname: string;
  score: number;
  best_streak?: number;
  fastest_count?: number;
  correct_count?: number;
  wrong_count?: number;
};

export type BestKind = "streak" | "fast" | "correct" | "score" | "showed_up";
export type WorstKind = "wrong" | "zero" | "no_fast" | "no_streak" | "low";

export type PlayerHighlights = {
  best: string;
  bestKind: BestKind;
  bestValue: number;
  worst: string;
  worstKind: WorstKind;
  worstValue: number;
};

const BEST_TEMPLATES: Record<BestKind, string[]> = {
  streak: [
    "Caught fire with a {n}-answer streak",
    "Strung together {n} in a row like a pro",
    "Went on a {n}-question heater",
  ],
  fast: [
    "Slapped lock first {n} times — reflexes of doom",
    "Beat everyone to the buzzer {n}×",
    "Twitchy thumbs: first to lock {n} times",
  ],
  correct: [
    "Banked {n} correct answers",
    "Quietly racked up {n} right",
    "Knew the answer {n} times. Smug.",
  ],
  score: [
    "Crossed the finish line with {n} pts",
    "Walked away with a respectable {n}",
    "Final tally: {n}. Not bad.",
  ],
  showed_up: [
    "Showed up. That's the highlight.",
    "Was present. Mostly.",
    "Held a controller successfully.",
  ],
};

const WORST_TEMPLATES: Record<WorstKind, string[]> = {
  wrong: [
    "Confidently wrong {n} times",
    "Locked in the wrong answer {n}×",
    "Guessed wrong with conviction. {n} times.",
  ],
  zero: [
    "Forgot to score any points. Awkward.",
    "Posted a clean zero. Pristine.",
    "0 points. A choice.",
  ],
  low: [
    "Limped home with {n} pts",
    "Crawled to {n}. We saw.",
    "A modest {n} pts. Very modest.",
  ],
  no_fast: [
    "Never once locked in first",
    "Last to commit on every round",
    "Buzzer-shy the whole night",
  ],
  no_streak: [
    "Never managed two in a row",
    "Streak counter: untouched",
    "Couldn't string two together",
  ],
};

// Short Vox quips — designed to be spoken in under ~2 seconds.
// Use {name} for nickname, {n} for the numeric stat where relevant.
const BEST_VOX: Record<BestKind, string[]> = {
  streak: [
    "{name} caught fire — {n} in a row. Disgusting.",
    "{n}-streak from {name}. Borderline cheating.",
    "{name} was on a heater. Cool it.",
  ],
  fast: [
    "{name}, fastest finger {n} times. Slow down.",
    "{n} first-locks for {name}. Twitchy.",
    "{name} kept beating the buzzer. Rude.",
  ],
  correct: [
    "{name} knew {n} answers. Nerd.",
    "{n} correct from {name}. Showoff.",
    "{name} brought a brain. Threatening.",
  ],
  score: [
    "{name} walked away with {n}. Respectable.",
    "{n} points for {name}. Mid-table royalty.",
    "{name} closed at {n}. Acceptable.",
  ],
  showed_up: [
    "{name} showed up. That counts.",
    "{name} was present. Bless.",
    "{name} held the controller. Hero.",
  ],
};

const WORST_VOX: Record<WorstKind, string[]> = {
  wrong: [
    "{name} got {n} wrong. With confidence.",
    "{n} wrong answers, {name}. Beautiful.",
    "{name} swung and missed {n} times.",
  ],
  zero: [
    "{name} scored zero. Immaculate.",
    "A clean nothing from {name}. Pristine.",
    "{name} forgot to score. We noticed.",
  ],
  low: [
    "{name} limped to {n}. Effort.",
    "{n} points, {name}. We've seen worse. Barely.",
    "{name} crawled to {n}. Painful.",
  ],
  no_fast: [
    "{name} never locked first. Not once.",
    "{name} stayed buzzer-shy all night.",
    "{name} loved being last to commit.",
  ],
  no_streak: [
    "{name} never strung two together.",
    "Streak counter for {name}: untouched.",
    "{name} couldn't manage back-to-back.",
  ],
};

function pick<T>(arr: T[], seedStr: string): T {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 131 + seedStr.charCodeAt(i)) >>> 0;
  return arr[seed % arr.length];
}

function isAdult(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem("btd-adult-mode") === "1"; } catch { return false; }
}

export function derivePlayerHighlights(p: HighlightPlayer): PlayerHighlights {
  const streak = p.best_streak ?? 0;
  const fast = p.fastest_count ?? 0;
  const correct = p.correct_count ?? 0;
  const wrong = p.wrong_count ?? 0;
  const score = p.score ?? 0;

  let bestKind: BestKind;
  let bestValue: number;
  if (streak >= 3) { bestKind = "streak"; bestValue = streak; }
  else if (fast >= 2) { bestKind = "fast"; bestValue = fast; }
  else if (correct >= 2) { bestKind = "correct"; bestValue = correct; }
  else if (score > 0) { bestKind = "score"; bestValue = score; }
  else { bestKind = "showed_up"; bestValue = 0; }

  let worstKind: WorstKind;
  let worstValue: number;
  if (wrong >= 2) { worstKind = "wrong"; worstValue = wrong; }
  else if (score === 0) { worstKind = "zero"; worstValue = 0; }
  else if (fast === 0) { worstKind = "no_fast"; worstValue = 0; }
  else if (streak < 2) { worstKind = "no_streak"; worstValue = 0; }
  else { worstKind = "low"; worstValue = score; }

  const adult = isAdult();
  const bestPool = adult ? BEST_TEMPLATES_ADULT[bestKind] : BEST_TEMPLATES[bestKind];
  const worstPool = adult ? WORST_TEMPLATES_ADULT[worstKind] : WORST_TEMPLATES[worstKind];
  const best = pick(bestPool, p.nickname + "b" + bestKind).replace("{n}", String(bestValue));
  const worst = pick(worstPool, p.nickname + "w" + worstKind).replace("{n}", String(worstValue));

  return { best, bestKind, bestValue, worst, worstKind, worstValue };
}

// Pick a short Vox one-liner that matches a specific caption.
// `side` chooses best vs worst; useful for alternating across players.
export function pickHighlightVox(
  h: PlayerHighlights,
  nickname: string,
  side: "best" | "worst",
): string {
  const adult = isAdult();
  if (side === "best") {
    const pool = adult ? BEST_VOX_ADULT[h.bestKind] : BEST_VOX[h.bestKind];
    return pick(pool, nickname + "vb" + h.bestKind)
      .replace("{name}", nickname)
      .replace("{n}", String(h.bestValue));
  }
  const pool = adult ? WORST_VOX_ADULT[h.worstKind] : WORST_VOX[h.worstKind];
  return pick(pool, nickname + "vw" + h.worstKind)
    .replace("{name}", nickname)
    .replace("{n}", String(h.worstValue));
}
