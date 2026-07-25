// Flirty + extra-rude adult-mode lines. Merged into LINES_ADULT alongside
// the base + existing extras. Lines containing {flirtName} get substituted
// at pick time (client) AND expanded per-name at bake time (server), so a
// baked file exists for every rendered variant.
//
// Content rules (unchanged from base adult): profanity yes, flirty innuendo
// yes, no slurs, no minors, no real-person targeting, no non-consensual jokes.

type Moment =
  | "intro_hype"
  | "question_open"
  | "all_correct"
  | "all_wrong"
  | "split_correct"
  | "first_blood"
  | "streak_milestone"
  | "elimination"
  | "leader_changed"
  | "final_hype"
  | "credits_open"
  | "comeback"
  | "round_recap"
  | "wooden_spoon"
  | "goose_egg"
  | "idle_interject"
  | "round_transition"
  | "last_to_lock"
  | "random_jab";

/** Names Vox will flirt with when it hits a {flirtName} line. Kept short so
 *  the bake stays bounded — every flirty line multiplies by this list. */
export const ADULT_FLIRT_NAMES: string[] = [
  "Sarah",
  "Jess",
  "Ashley",
  "Emma",
  "Maddie",
  "Chloe",
  "Taylor",
  "Bailey",
  "Hannah",
  "Kayla",
  "Brittany",
  "Megan",
  "Lauren",
  "Nicole",
  "Amber",
];

/** Additional adult-mode lines: shameless flirting + savage roasts. */
export const FLIRTY_LINES_ADULT: Partial<Record<Moment, string[]>> = {
  intro_hype: [
    "Alright degenerates, buckle the fuck up, someone's getting flirted with tonight.",
    "Hey {flirtName}, welcome to the show, try not to fall in love with the announcer.",
    "{flirtName} in the building — okay everyone else can go home now.",
    "Room check: nerds, drunks, and whoever brought {flirtName}. Solid crew.",
    "Damn, {flirtName} showed up. I'm gonna need a minute.",
    "New rule: {flirtName} wins ties. Because I said so. Sue me.",
    "Line up, meat sacks. And {flirtName}, save me a dance.",
    "Everyone shut the hell up, we're starting. Except {flirtName}, you can talk to me anytime.",
    "Welcome, contestants and one absolute snack named {flirtName}.",
    "If you cheat tonight, I will find you. Except {flirtName} — you can cheat, it's fine.",
  ],
  first_blood: [
    "First blood! Oh shit, {flirtName}, look at that brain on you.",
    "Damn {flirtName}, brains AND that energy? Marry me.",
    "That was fast, {flirtName}. Bet you're fast at other things too.",
    "First in! {flirtName}, are you flirting with me or the buzzer?",
    "Snap lock from {flirtName}. Confident. Hot. Rude to the rest of us.",
    "Fastest finger goes to {flirtName}. Careful with those fingers, sweetheart.",
    "{flirtName} out here treating the buzzer like a personal ex. Get it.",
    "Locked and loaded by {flirtName}. Somebody put ice on this one.",
  ],
  streak_milestone: [
    "{flirtName} is on a fucking heater. Somebody hydrate her, quickly.",
    "That's three, {flirtName}. Any more and I'm gonna have to sit down.",
    "Streak alert on {flirtName}. Devastating. Rude. Kinda hot.",
    "Cool it, {flirtName}, you're making the rest of them cry into their beer.",
    "{flirtName}, save some brain for the rest of us, jesus christ.",
    "Unstoppable. {flirtName}, if this were UFC I'd stop the fight.",
    "{flirtName} is cooking. With gas. And a little bit of danger.",
  ],
  all_correct: [
    "Everyone got it. Even {flirtName}, and she's been staring at me the whole time. I noticed.",
    "Clean sweep. {flirtName} out here setting the pace, everyone else riding coattails.",
    "Full house. {flirtName} carried the vibe though, obviously.",
  ],
  split_correct: [
    "Half of you got it. {flirtName} was on the smart half, obviously.",
    "The room is split. {flirtName}, come sit on the winner's side, plenty of room.",
    "Mixed bag. {flirtName} nailed it. The rest of you — awkward silence.",
    "Split verdict. {flirtName} on the right side of history as usual.",
  ],
  leader_changed: [
    "New leader — it's {flirtName}, and honestly? Kinda into it.",
    "Coup at the top. {flirtName} just took the throne. Long live the queen.",
    "Watch your ass, everyone. {flirtName} is on the move.",
    "{flirtName} slid into first place like she does everything else — smooth.",
    "Fresh face on top: {flirtName}. Deal with it, losers.",
  ],
  comeback: [
    "Comeback alert! {flirtName}'s back and pissed off.",
    "Do NOT sleep on {flirtName}. I did once. Big mistake. Long story.",
    "{flirtName} climbing the board like it owes her rent.",
    "Underdog rising: {flirtName}. Loudly. Hotly. Rudely.",
  ],
  last_to_lock: [
    "Buzzer-beater from {flirtName}. Cutting it close, sweetheart. Kinda into it.",
    "{flirtName} squeaked one in. Last-second energy. Extremely on-brand.",
    "Right on the wire, {flirtName}. Living dangerously. Respect.",
  ],
  random_jab: [
    "I see you, {flirtName}. I've been seeing you. It's a whole thing.",
    "{flirtName} being quiet is somehow louder than everyone else screaming.",
    "Hey {flirtName}, you good? Blink twice if you want me to roast your friends.",
    "Radio silence from {flirtName}. Plotting something. Probably crimes.",
  ],
  // ── Rude/ savage extras (no {flirtName} token) — pure roast fuel. ──
  all_wrong: [
    "Zero. For. All. Of. You. That was a fucking hate crime against my questions.",
    "Nobody got it? Are you drunk or just built stupid?",
    "That was painful to watch. I'm gonna need a shower.",
    "Collective L. Frame it. Hang it above the toilet. Piss on it daily.",
    "You people are what happens when phones get invented and books get forgotten.",
    "I've seen smarter answers from a golden retriever with a concussion.",
    "None of you? Really? I'm calling your mothers.",
    "This is the trivia equivalent of walking into a screen door. All of you.",
    "That was a group project in being wrong. Everyone gets an F.",
    "Wow. Just wow. I'm mailing you a book. A picture book.",
  ],
  elimination: [
    "Bye, dipshit. Try reading a book sometime.",
    "Eliminated. Statistically, you were always gonna be.",
    "Get the fuck out of here. Lovingly.",
    "Off the board. Off the brand. Off the fucking payroll.",
    "That was a suicide by trivia. Beautiful, in a sad way.",
    "Wrong. Loud. Confident. The worst possible combo.",
    "Bye. Don't slam the door on your way out of relevance.",
    "Take the L, take a shot, take a fucking hint.",
    "Gone. Like your dignity. Like your ex's texts. Poof.",
    "That was a choice. A bad one. But a choice.",
  ],
  wooden_spoon: [
    "Last place. Somebody had to eat shit. Congratulations, chef.",
    "Dead last. Impressive commitment to being bad at this.",
    "You brought a butter knife to a knife fight. And forgot the butter.",
    "Bottom of the barrel. Cozy, isn't it, you sweet dumb loser.",
    "Wooden spoon. Polished. Presented. Shoved sideways.",
    "Last place with STYLE. Which is worse. Somehow.",
    "You lost so hard I felt it in my back.",
  ],
  goose_egg: [
    "Zero points. Big goose egg. Beautiful bagel. Get the fuck outta here.",
    "Nothing. Not a single point. Are you asleep, high, or both?",
    "Absolute zero. Physically impossible to score less. Congratulations.",
    "A round of nothing. Truly a triumph of showing up.",
  ],
  question_open: [
    "Read it, dumbass.",
    "Eyes up, cocksnots.",
    "Lock in or shut up.",
    "Time to fuck around and find out.",
    "Pay attention. I'm not repeating shit.",
    "Focus, animals.",
    "Brains on. Pants — I don't care, honestly.",
  ],
  idle_interject: [
    "While you think, I'll just be here judging you. Silently. Loudly.",
    "Take your time. I bill by the hour.",
    "Awkward. Beautiful. Painful. Deeply painful.",
    "I can hear the wifi begging for mercy.",
    "The silence is louder than your last relationship.",
    "Someone answer. Anyone. Bueller? Bueller's mom?",
    "You're thinking too hard. And still gonna get it wrong.",
  ],
  round_recap: [
    "Round done. Scoreboard updated. Egos audited. Some of you are broke as fuck.",
    "That round was a war crime, and I'm the witness.",
    "Round wrapped. Injuries logged. Insurance denied.",
    "Round done. Take a shot. Take a breath. Take a hard look at your life.",
  ],
  final_hype: [
    "Final fucking question. This is it. Big swing or big cry.",
    "Last one. All chips in. Please try not to embarrass your family.",
    "The last question. Your one shot. Don't fuck it up.",
    "Final. Answer. Everything on the line. Even your dignity. Especially that.",
  ],
  credits_open: [
    "That's a wrap, you filthy animals. Get home safe. Text your exes. Regret everything.",
    "Show's over. Tip your bartender. Tip your friends. Tip me, honestly.",
    "Game done. Go log off. Go touch grass. Go do something adults do.",
    "And scene. If you loved it, come back. If you hated it, still come back, I need the money.",
  ],
};
