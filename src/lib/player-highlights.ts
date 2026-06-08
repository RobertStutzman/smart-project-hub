// Per-player best/worst caption derivation for the credits highlight reel.

export type HighlightPlayer = {
  nickname: string;
  score: number;
  best_streak?: number;
  fastest_count?: number;
  correct_count?: number;
  wrong_count?: number;
};

const BEST_TEMPLATES = {
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

const WORST_TEMPLATES = {
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

function pick<T>(arr: T[], seedStr: string): T {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 131 + seedStr.charCodeAt(i)) >>> 0;
  return arr[seed % arr.length];
}

export function derivePlayerHighlights(p: HighlightPlayer): { best: string; worst: string } {
  const streak = p.best_streak ?? 0;
  const fast = p.fastest_count ?? 0;
  const correct = p.correct_count ?? 0;
  const wrong = p.wrong_count ?? 0;
  const score = p.score ?? 0;

  // Best caption — pick the strongest signal.
  let best: string;
  if (streak >= 3) best = pick(BEST_TEMPLATES.streak, p.nickname + "s").replace("{n}", String(streak));
  else if (fast >= 2) best = pick(BEST_TEMPLATES.fast, p.nickname + "f").replace("{n}", String(fast));
  else if (correct >= 2) best = pick(BEST_TEMPLATES.correct, p.nickname + "c").replace("{n}", String(correct));
  else if (score > 0) best = pick(BEST_TEMPLATES.score, p.nickname + "p").replace("{n}", String(score));
  else best = pick(BEST_TEMPLATES.showed_up, p.nickname + "u");

  // Worst caption — strongest embarrassment.
  let worst: string;
  if (wrong >= 2) worst = pick(WORST_TEMPLATES.wrong, p.nickname + "w").replace("{n}", String(wrong));
  else if (score === 0) worst = pick(WORST_TEMPLATES.zero, p.nickname + "z");
  else if (fast === 0) worst = pick(WORST_TEMPLATES.no_fast, p.nickname + "nf");
  else if (streak < 2) worst = pick(WORST_TEMPLATES.no_streak, p.nickname + "ns");
  else worst = pick(WORST_TEMPLATES.low, p.nickname + "l").replace("{n}", String(score));

  return { best, worst };
}
