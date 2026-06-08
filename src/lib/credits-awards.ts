// Credit-reel "award" roasts. Each line uses {name} as a placeholder.
// Tone matches the host: short, biting, then move on.

export type AwardKey =
  | "champion"
  | "brain"
  | "fastest"
  | "streak"
  | "wrong"
  | "spoon";

const POOLS: Record<AwardKey, string[]> = {
  champion: [
    "Tonight's champion: {name}. Frame it.",
    "{name} takes the crown. Soak it in, briefly.",
    "Winner, winner — {name}. Don't get cocky.",
    "{name} on top. Mark the day in your diary.",
    "Your champion, {name}. Earned. Probably.",
  ],
  brain: [
    "Brain of the night: {name}. Smug allowed.",
    "{name} knew too much. Suspicious, honestly.",
    "Most correct answers — {name}. Nerd.",
    "{name} brought the IQ tonight. Threatening.",
    "Big brain award: {name}. Insufferable.",
  ],
  fastest: [
    "Fastest finger: {name}. Reflexes of a goblin.",
    "{name} kept beating the buzzer. Annoying.",
    "Speed demon: {name}. Slow down, freak.",
    "{name} hit lock before you finished reading. Rude.",
    "Quickest trigger goes to {name}. Cool it.",
  ],
  streak: [
    "Hot streak king: {name}. Bring the ice bath.",
    "{name} couldn't miss. Genuinely upsetting.",
    "Longest streak — {name}. Bordering on cheating.",
    "{name} went on a heater. Call a doctor.",
    "Streak award: {name}. Show off.",
  ],
  wrong: [
    "Most confident wrong: {name}. Bold strategy.",
    "{name} guessed wrong with conviction. Beautiful.",
    "Award for fully committed mistakes: {name}.",
    "{name} was so sure. So very wrong.",
    "Confidently incorrect — {name}. Iconic.",
  ],
  spoon: [
    "Wooden spoon goes to {name}. Try harder next time.",
    "{name} polished the basement. Slippery work.",
    "Last place award: {name}. Somebody had to.",
    "{name}, the floor called. It misses you.",
    "Anchor of the night: {name}. We salute you.",
  ],
};

export function pickAwardRoast(award: AwardKey, nickname: string): string {
  const pool = POOLS[award];
  const seed = (nickname.length * 131 + (nickname.charCodeAt(0) || 0)) >>> 0;
  return pool[seed % pool.length].replace("{name}", nickname);
}
