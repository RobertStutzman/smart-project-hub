// Adult-mode lobby banter pool.
// Content rules:
//   - F-bombs, shit, asshole, bullshit, dick, balls, horny, crude metaphors: yes.
//   - Slurs of any kind: no.
//   - Sexual content involving minors, real public figures, or non-consensual scenarios: no.
//   - Tokens: {count} (current player count) and {code} (room code).

export const OPENER_LINES_ADULT: string[] = [
  "Scan the fuckin QR code or punch in the four letters. We don't have all night.",
  "Phones up, dipshits — scan the QR, or type the code. That's your ticket in.",
  "Point your camera at the QR like you know what you're doing. Or just type the goddamn code.",
  "Grab your phone, scan the QR, hop in. It's not rocket science. It's barely trivia.",
  "Scan the code on the screen. QR or four letters. Pick one and stop fondling your phone.",
];

const IDLE_EMPTY_ADULT: string[] = [
  "Zero players. Bold fucking strategy. Anyone?",
  "Crickets. Even the crickets are out getting laid.",
  "Still no players. I'm gonna take this personally and start drinking.",
  "Is this thing on? Hello? The code is right fucking there.",
  "Empty lobby. Big single-on-Valentines-Day energy in here.",
  "Population: zero. Hornier than my DMs.",
  "I'll stand here. Looking hot. Waiting. Decaying.",
  "Nobody? Really? I shaved for this.",
  "An empty lobby walks into a bar. That's the joke. That's where we fuckin are.",
  "Cool, cool, cool. Just me, the void, and a vague erection of disappointment.",
  "If a trivia host hosts in an empty room, does anyone hear him swear?",
  "Calling all humans. This is not a drill. Or maybe it is. I'm bored and lubricated.",
];

const IDLE_LOW_ADULT: string[] = [
  "{count} player. A lonely champion. Or a lonely loser. Either way, kinda sad.",
  "Just {count} so far. Tell your friends. Beg. Promise sexual favors.",
  "{count} brave soul. Reminds me of my last birthday party. Which I cried at.",
  "We've got {count}. Code is {code}. Pass it around like a joint.",
  "{count} in. That's a start. A pathetic, microscopic start.",
  "{count} player. The chosen one. Or the only one who could find the goddamn link.",
  "{count} so far. Quality over quantity, right? RIGHT?",
  "Look at you, {count} strong. A small but mighty army of trivia goblins.",
  "{count} brave enough to show up. The rest of your friends are cowards.",
];

const IDLE_MID_ADULT: string[] = [
  "{count} players in. Not bad. Not great. Get the rest of your shithead friends in here.",
  "{count} of you ready to lose with dignity. Beautiful. Hopeless.",
  "We're at {count}. Round it up. I don't trust odd numbers and neither should you.",
  "{count} players. Code is {code}. Stragglers, this is your moment to stop scrolling porn.",
  "{count} contestants. Decent turnout. Could be better. No pressure, dickheads.",
  "{count} in the room. Half of you look way too fucking confident.",
  "We're at {count}. Tell that one friend who always claims to be smart. Yeah. That one.",
  "{count} players warming up. I see at least two of you Googling already, you cheating bastards.",
  "{count} ready to rumble. Or stand awkwardly, half-erect with nerves. Same thing here.",
];

const IDLE_HIGH_ADULT: string[] = [
  "{count} players! Now we're fucking cooking. One more, then we go.",
  "Look at this crowd — {count} strong. Somebody's getting humbled and possibly humped.",
  "{count} contestants warming up. I can smell the desperation. And the body spray.",
  "{count} in the lobby. Hope you stretched. There will be tears and minor erections.",
  "{count} of you! This is a real party now. A sad, competitive, possibly horny party.",
  "{count} brains assembled. Probably six functional ones. The rest are vibes.",
  "{count} players. The lobby is full. The egos are fuller. The pants, fullest.",
  "{count} in. I haven't seen a crowd this hyped since the last fire drill at the strip club.",
  "{count} contestants. Choose your enemies wisely. And your alliances, dirtier.",
];

const IDLE_GENERIC_ADULT: string[] = [
  "Tick fucking tock. I'm not getting any younger and neither is this trivia.",
  "Any day now, friends. My will to live is finite.",
  "I've waited longer for pizza. And the pizza was bad. Get in here.",
  "If we wait any longer I'm gonna start asking questions to my own dick.",
  "Whoever's still typing their nickname — there's no prize for creativity. Pick 'BigDong' and commit.",
  "Last call for the bathroom break. Wipe twice.",
  "I'm running out of small talk. And patience. And dignity.",
  "If you're stalling because you're nervous — fair. Also, grow a pair.",
  "Stretch a hamstring. Crack a knuckle. Anything. We're so close.",
  "I'd start a podcast in the time it's taking some of you to type a goddamn nickname.",
  "Whoever's debating between two nicknames — they're both bad. Pick the dumb one. Always pick the dumb one.",
  "I can hear you scrolling. Commit to a username, you coward.",
  "Final boarding call. Doors closing eventually. Hopefully. Begrudgingly.",
];

const IDLE_JOIN_NUDGE_ADULT: string[] = [
  "Come on, the code is right fucking there — {code}. Four letters. You got this. Maybe.",
  "The code is {code}. Yes. STILL. It hasn't moved. Neither have your friends, apparently.",
];

export const WELCOME_INTROS_ADULT: string[] = [
  "Welcome to Beat the Drop — the trivia show where confidence comes to fucking die.",
  "Lights up. It's Beat the Drop. The only trivia game with a body count and a tab at the bar.",
  "You're tuned in to Beat the Drop. Brains optional. Bravery required. Pants, encouraged.",
  "Beat the Drop, baby. Where your friends find out what a dumbass you actually are.",
  "Welcome, welcome, welcome to Beat the Drop. Bring snacks. Bring shame. Bring lube.",
  "It's Beat the Drop. Trivia's loudest, meanest, horniest disaster.",
  "Beat the Drop is live. Brains in, egos out, nobody leaves with their dignity.",
  "Roll the lights. It's Beat the Drop — the show that turns friends into enemies and roommates into refugees.",
  "Welcome to Beat the Drop. Twenty questions. One survivor. Zero mercy. Several boners.",
  "Beat the Drop, coming at you hot. Don't blink. Don't think too hard. Don't text your ex.",
  "Tonight, on Beat the Drop — somebody peaks, somebody panics, somebody pisses themselves. Let's find out which.",
  "Welcome in to Beat the Drop, where the questions hit harder than your dad ever did.",
  "It's showtime on Beat the Drop. The only thing dropping faster is your dignity. And your pants, hopefully.",
  "Beat the Drop. The trivia game your group chat will fight about for weeks.",
];

function fill(line: string, count: number, code: string): string {
  return line.replaceAll("{count}", String(count)).replaceAll("{code}", code);
}

export function pickLobbyLineAdult(
  history: string[],
  count: number,
  code: string,
): { spoken: string; raw: string } {
  let pool: string[];
  if (count === 0) pool = [...IDLE_EMPTY_ADULT, ...IDLE_JOIN_NUDGE_ADULT, ...IDLE_GENERIC_ADULT];
  else if (count <= 2) pool = [...IDLE_LOW_ADULT, ...IDLE_GENERIC_ADULT];
  else if (count <= 5) pool = [...IDLE_MID_ADULT, ...IDLE_GENERIC_ADULT];
  else pool = [...IDLE_HIGH_ADULT, ...IDLE_GENERIC_ADULT];

  const recent = new Set(history.slice(-3));
  const fresh = pool.filter((l) => !recent.has(l));
  const choices = fresh.length > 0 ? fresh : pool;
  const raw = choices[Math.floor(Math.random() * choices.length)];
  return { spoken: fill(raw, count, code), raw };
}

export function pickOpenerAdult(): string {
  return OPENER_LINES_ADULT[Math.floor(Math.random() * OPENER_LINES_ADULT.length)];
}

export function pickWelcomeIntroAdult(): string {
  return WELCOME_INTROS_ADULT[Math.floor(Math.random() * WELCOME_INTROS_ADULT.length)];
}
