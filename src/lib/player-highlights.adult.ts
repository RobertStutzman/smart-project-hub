// Adult-mode credits highlight captions + Vox quips.
// Content rules same as the other adult pools: profanity + crude humor,
// no slurs, no minors, no real-person targeting.

import type { BestKind, WorstKind } from "@/lib/player-highlights";

export const BEST_TEMPLATES_ADULT: Record<BestKind, string[]> = {
  streak: [
    "Caught fuckin fire with a {n}-answer streak",
    "Strung together {n} in a row like a goddamn pro",
    "Went on a {n}-question heater. Disgusting.",
  ],
  fast: [
    "Slapped lock first {n} times — reflexes of doom",
    "Beat everyone to the buzzer {n} times, ya cocky bastard",
    "Twitchy thumbs of a horny gremlin: first to lock {n} times",
  ],
  correct: [
    "Banked {n} correct answers. Nerd shit.",
    "Quietly racked up {n} right. Suspicious.",
    "Knew the answer {n} times. Smug as fuck.",
  ],
  score: [
    "Crossed the finish line with {n} pts. Not bad.",
    "Walked away with a respectable {n}",
    "Final tally: {n}. We've seen worse. Much worse.",
  ],
  showed_up: [
    "Showed up. That's the fuckin highlight.",
    "Was present. Mostly.",
    "Held a controller successfully. Hero.",
  ],
};

export const WORST_TEMPLATES_ADULT: Record<WorstKind, string[]> = {
  wrong: [
    "Confidently wrong {n} times. Iconic.",
    "Locked in the wrong answer {n} times. With conviction.",
    "Guessed wrong with full chest. {n} times.",
  ],
  zero: [
    "Forgot to score any points. Awkward as hell.",
    "Posted a clean zero. Pristine.",
    "0 points. A fuckin choice.",
  ],
  low: [
    "Limped home with {n} pts. Pathetic.",
    "Crawled to {n}. We all saw.",
    "A modest {n} pts. Very, very modest.",
  ],
  no_fast: [
    "Never once locked in first. Not once.",
    "Last to commit on every round, ya coward.",
    "Buzzer-shy the whole damn night",
  ],
  no_streak: [
    "Never managed two in a row. Not even once.",
    "Streak counter: untouched. Like the questions.",
    "Couldn't string two together. Tragic.",
  ],
};

export const BEST_VOX_ADULT: Record<BestKind, string[]> = {
  streak: [
    "{name} caught fire — {n} in a row. Disgusting.",
    "{n}-streak from {name}. Borderline cheating.",
    "{name} was on a heater. Cool it, asshole.",
  ],
  fast: [
    "{name}, fastest finger {n} times. Slow the fuck down.",
    "{n} first-locks for {name}. Twitchy little gremlin.",
    "{name} kept beating the buzzer. Rude.",
  ],
  correct: [
    "{name} knew {n} answers. Nerd.",
    "{n} correct from {name}. Showoff.",
    "{name} brought a brain. Threatening behavior.",
  ],
  score: [
    "{name} walked away with {n}. Respectable.",
    "{n} points for {name}. Mid-table royalty.",
    "{name} closed at {n}. Acceptable.",
  ],
  showed_up: [
    "{name} showed up. That counts. Barely.",
    "{name} was present. Bless.",
    "{name} held the controller. Hero of the people.",
  ],
};

export const WORST_VOX_ADULT: Record<WorstKind, string[]> = {
  wrong: [
    "{name} got {n} wrong. With confidence. Beautiful.",
    "{n} wrong answers, {name}. Magnificent.",
    "{name} swung and missed {n} times. Like my dad.",
  ],
  zero: [
    "{name} scored zero. Immaculate fuckup.",
    "A clean nothing from {name}. Pristine.",
    "{name} forgot to score. We noticed. We logged it.",
  ],
  low: [
    "{name} limped to {n}. Effort, allegedly.",
    "{n} points, {name}. We've seen worse. Not much worse.",
    "{name} crawled to {n}. Painful to watch.",
  ],
  no_fast: [
    "{name} never locked first. Not once. Coward.",
    "{name} stayed buzzer-shy all night. Therapeutic.",
    "{name} loved being last to commit. Familiar.",
  ],
  no_streak: [
    "{name} never strung two together. Tragic.",
    "Streak counter for {name}: untouched. Like the brain.",
    "{name} couldn't manage back-to-back. Embarrassing.",
  ],
};
