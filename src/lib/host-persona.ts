// Host persona — "Vox", the in-game emcee.
// Catchphrases used by HostGameStage to react to game moments.
// Lines are intentionally short so the browser speechSynthesis voice
// (or a pre-baked TTS file) reads them in under ~3 seconds.

export const HOST_NAME = "Vox";

type Moment =
  | "intro_hype"        // cold open, after title card
  | "question_open"     // brand new question hits the screen
  | "all_correct"       // entire room got it
  | "all_wrong"         // entire room whiffed
  | "split_correct"     // some right, some wrong
  | "first_blood"       // first to lock and correct
  | "streak_milestone"  // 3+/5+/7+ streak
  | "elimination"       // wrong answer dropped
  | "leader_changed"    // new #1 on leaderboard
  | "final_hype"        // entering final round
  | "credits_open";     // outro credits start

export const LINES: Record<Moment, string[]> = {
  intro_hype: [
    "Buckle up. The drop is coming.",
    "Fingers on buzzers. Egos at the door.",
    "Let's find out who actually paid attention in school.",
    "Welcome, contestants. And condolences in advance.",
    "Brains warm? Good. Let's break some.",
    "I hope you brought your A-game. B-game won't cut it.",
    "Shoes off, gloves on. We're going in.",
    "May the smartest survive. Or the luckiest. Whatever.",
    "Trivia night, baby. Don't embarrass yourselves.",
    "Let's see who came to play and who came to watch.",
  ],
  question_open: [
    "Here we go.",
    "Lock it in.",
    "Don't think — feel.",
    "Eyes up.",
    "Next!",
    "Show me what you got.",
    "Three seconds. Decide.",
    "No guessing. Knowing.",
    "Easy one. Probably.",
    "Tap fast. Think faster.",
    "Make me proud.",
    "Don't choke.",
  ],
  all_correct: [
    "Look at you, all of you, correct. Suspicious.",
    "A clean sweep. The category was too kind.",
    "Everybody right? Boring. Next one's harder.",
    "Unanimous! Either you're geniuses or I'm too easy.",
    "Full house. I'll be turning up the heat.",
    "Wow. Solidarity in correctness. Disgusting.",
    "Perfect score across the board. Mark the calendar.",
    "Nobody missed. Nobody. I'm offended.",
    "All correct. The bar was apparently underground.",
    "Sweep! Don't get used to it.",
  ],
  all_wrong: [
    "Oof. Not a single one. Painful.",
    "Zero for the room. I'm secondhand embarrassed.",
    "Wow. Just... wow. Moving on.",
    "Goose egg across the board. Beautiful.",
    "Did you even read the question?",
    "Collective brainfart. Take a beat.",
    "Nobody. Got. That. Right. Incredible.",
    "Group failure is still failure, friends.",
    "Zero. Nada. Nil. I love it.",
    "I'd say try harder, but it's too late now.",
  ],
  split_correct: [
    "Half of you guessed. The other half KNEW.",
    "The room is split. Drama.",
    "Some hits, some misses. That's a game.",
    "Mixed bag. Spicy.",
    "Some of you read. Some of you panicked.",
    "Divide and conquered. By the question.",
    "Half right, half wrong, all judged.",
    "A schism! The trivia gods are pleased.",
    "Split decision. The judges weep.",
    "Some genius, some chaos. Perfect.",
  ],
  first_blood: [
    "First in, dead on. Showoff.",
    "Lock that in, you cocky genius.",
    "Fastest finger, sharpest brain. Rude.",
    "Speed kills. So does being right.",
    "Out of the gate like a rocket.",
    "Locked. Loaded. Correct. Annoying.",
    "First blood goes to the brain.",
    "Sniped it. Move over.",
    "That was fast. Suspiciously fast.",
    "Hot hand alert.",
  ],
  streak_milestone: [
    "Somebody's on fire over here.",
    "Three in a row. Calm down, champ.",
    "Stop. Let someone else feel things.",
    "Streak watch is officially activated.",
    "This person is showing off now.",
    "Heater alert. Get the ice bath.",
    "You're starting to scare me.",
    "A streak this hot needs a permit.",
    "Save some for the rest of the class.",
    "I'm calling your mom. She'd be proud.",
  ],
  elimination: [
    "And another one bites the drop.",
    "Wrong. Try faster next time.",
    "That was a guess, wasn't it.",
    "Oof. Take a seat.",
    "Painful. Educational. Mostly painful.",
    "Goodbye, sweet contestant.",
    "Lights out on that one.",
    "Wrong button, wrong answer, wrong day.",
    "And just like that — gone.",
    "We hardly knew you.",
  ],
  leader_changed: [
    "New leader! The throne is wobbly.",
    "Coup at the top of the board.",
    "Watch yourself, last round's winner.",
    "Lead change! The peasants revolt.",
    "Old king is dead. Long live the new king.",
    "Upset at the top. Drama, drama, drama.",
    "Power shift. The board never lies.",
    "We have a new front-runner. For now.",
    "Someone just snuck into first. Sneaky.",
    "Leaderboard reshuffled. Try to keep up.",
  ],
  final_hype: [
    "This. Is. The Final Drop. Bet big or go home small.",
    "One question. Everything on the table. Try not to cry.",
    "Final round. The standings mean nothing now.",
    "All chips in. All gloves off.",
    "This is where legends are made — or memes.",
    "Make it count. Or don't. Up to you.",
    "Bet brave or bet broke. Your call.",
    "One more. Everything to lose. Have fun.",
    "Final question incoming. Try to breathe.",
    "The big one. Don't blink.",
  ],
  credits_open: [
    "And that's the show. Roll credits.",
    "Game over. Survivors, please bow.",
    "Take a bow, contestants. Or don't, last place.",
    "That's a wrap. Thanks for the chaos.",
    "Show's done. The trivia gods rest.",
    "Curtains. Hug your neighbor or don't.",
    "All over. Until next time.",
    "And we're out. Mic dropped.",
    "Lights up. Pride down. Good night.",
    "That'll do, contestants. That'll do.",
  ],
};

/** Pick a deterministic-feeling line for a moment, with seed for variety. */
export function pickLine(moment: Moment, seed: string | number = Date.now()): string {
  const pool = LINES[moment];
  const s = typeof seed === "string" ? seed.length + seed.charCodeAt(0) : Math.floor(seed);
  return pool[Math.abs(s) % pool.length];
}

/** Speak a persona line in The Elf's voice (ElevenLabs). */
export function speakPersona(text: string, opts?: { volume?: number; interrupt?: boolean; preset?: "hype" | "calm" }) {
  if (typeof window === "undefined") return;
  // Dynamic import keeps the server function reference out of any SSR path
  // that imports host-persona purely for catchphrase strings.
  void import("@/lib/elf-voice").then(({ speakAsElf }) => {
    void speakAsElf(text, {
      volume: opts?.volume ?? 1.0,
      interrupt: opts?.interrupt ?? false,
      preset: opts?.preset ?? "hype",
    });
  });
}
