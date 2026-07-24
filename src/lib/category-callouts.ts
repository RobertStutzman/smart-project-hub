// Category-flavored host lines. Spoken (optionally) by HostGameStage when
// a new question opens, and baked into the persona pack via
// ALL_CATEGORY_CALLOUTS so playback is free at runtime.
//
// Kept short (~4–10 words) so they queue and clear before the question
// TTS starts.

const GENERIC_TEASES: string[] = [
  "Category live. Focus up.",
  "Fresh category. New pain.",
  "Category shift. Adjust.",
  "New topic. Old regrets.",
  "Category loaded. Brains, please.",
];

const CATEGORY_TEASES: Record<string, string[]> = {
  Movies: [
    "Cinema time. No spoilers, only shame.",
    "Movies round. Pretend you've seen them.",
    "Film time. Fake it convincingly.",
    "Movies. Popcorn optional. Panic mandatory.",
  ],
  Music: [
    "Music round. Hum quietly, guess loudly.",
    "Music time. Prove you paid attention.",
    "Music round — earbuds off, brains on.",
    "Songs and singers. Try to keep up.",
  ],
  Sports: [
    "Sports round. Casuals beware.",
    "Sports. Facts, not feelings.",
    "Sports round — clock's ticking, jerseys off.",
    "Sports. Guess with confidence. Guess wrong loudly.",
  ],
  History: [
    "History round. Pretend you paid attention.",
    "History. Old stuff. New tears.",
    "History round — dust off the brain.",
    "History. Dates matter. Sadly.",
  ],
  Science: [
    "Science round. Big words. Small brains.",
    "Science time. Round earth only, please.",
    "Science round — measure twice, guess once.",
    "Science. Facts, no vibes.",
  ],
  Geography: [
    "Geography. Point at maps mentally.",
    "Geography round. Time zones welcome.",
    "Geography — pick a continent, any continent.",
    "Geography round. Atlases weep.",
  ],
  Food: [
    "Food round. Hungry brains only.",
    "Food. Guess with your mouth.",
    "Food round — snacks help.",
    "Food. Ingredients matter now.",
  ],
  TV: [
    "TV round. Remember TV?",
    "TV. Streaming counts. Barely.",
    "TV round — pretend you finished the series.",
    "TV. Reruns count. Recaps don't.",
  ],
  Gaming: [
    "Gaming round. Controllers up.",
    "Gaming — respawn your brain.",
    "Gaming round. Achievement pending.",
    "Gaming. Points, not lives.",
  ],
  Animals: [
    "Animals round. Cute or cursed.",
    "Animals — mammals get a boost. Kidding.",
    "Animals round. Zoo brains only.",
    "Animals. Bark answers.",
  ],
  Literature: [
    "Books round. Pretend you finished them.",
    "Literature. Skim answers welcome.",
    "Books — CliffsNotes-tier knowledge accepted.",
    "Literature round. Judge the covers.",
  ],
  Tech: [
    "Tech round. Reboot the brain.",
    "Tech — buffering answers.",
    "Tech round. Try turning it off and on.",
    "Tech. Version numbers matter.",
  ],
  Art: [
    "Art round. Squint intelligently.",
    "Art — pretend you understand.",
    "Art round. Signature counts.",
    "Art. Colors, dates, tears.",
  ],
  Business: [
    "Business round. Wallets warm up.",
    "Business — quarter reports welcome.",
    "Business round. Bosses beware.",
    "Business. Money answers.",
  ],
  Random: [
    "Random round. Anything goes.",
    "Random — brace yourselves.",
    "Random round. Chaos loaded.",
    "Random. No warning. No mercy.",
  ],
};

const DIFFICULTY_REACTIONS: Record<string, string[]> = {
  easy: [
    "Layup incoming.",
    "Freebie. Don't blow it.",
    "Easy one. Don't overthink.",
    "Softball. Swing anyway.",
  ],
  medium: [
    "Medium heat. Focus.",
    "Not easy, not evil. Sharp up.",
    "Middle of the pack. No excuses.",
    "Medium — real one.",
  ],
  hard: [
    "Nasty one. Buckle in.",
    "Hard. Painful. Beautiful.",
    "This one bites. Brace.",
    "Hard mode. Big brains only.",
  ],
};

/** Return a short pre-question flavor line for the category/difficulty. */
export function getCategoryTease(
  category: string | null | undefined,
  difficulty: string | null | undefined,
  seed: number,
): string {
  const catPool = category && CATEGORY_TEASES[category] ? CATEGORY_TEASES[category] : GENERIC_TEASES;
  const diffPool = difficulty && DIFFICULTY_REACTIONS[difficulty]
    ? DIFFICULTY_REACTIONS[difficulty]
    : null;
  // 50/50 category vs difficulty reaction (when both present); otherwise use whichever exists.
  const pool = diffPool && seed % 2 === 0 ? diffPool : catPool;
  const idx = Math.abs(seed) % pool.length;
  return pool[idx];
}

/** Every string the tease system can return — baked once, replayed forever. */
export const ALL_CATEGORY_CALLOUTS: string[] = (() => {
  const out: string[] = [];
  out.push(...GENERIC_TEASES);
  for (const lines of Object.values(CATEGORY_TEASES)) out.push(...lines);
  for (const lines of Object.values(DIFFICULTY_REACTIONS)) out.push(...lines);
  return out;
})();
