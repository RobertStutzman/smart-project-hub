// Lobby announcer banter — opener + rotating idle quips while waiting for players.
// Lines may contain `{count}` (current player count) and `{code}` (room code) tokens.

export const OPENER_LINES: string[] = [
  "Scan the QR code on screen, or type the four-letter code to join.",
  "Point your camera at the QR code — or punch in the code on screen. Let's get you in.",
  "Phones up: scan the QR, or type the code. That's your ticket in.",
  "Grab your phone, scan that QR code, and hop in the lobby.",
  "Scan the code on screen — QR or four letters, your call.",
];

const IDLE_EMPTY: string[] = [
  "Zero players. Bold strategy. Anyone? Anyone?",
  "Wow. Crickets. Even the crickets left.",
  "Still no players. I'm starting to take this personally.",
  "Is this thing on? Hello? The code is right there. Use it.",
  "Empty lobby vibes. Don't make me start without you.",
  "Population: zero. Like my fan club.",
  "I'll just stand here. Looking pretty. Waiting.",
  "Nobody? Really? I dressed up for this.",
  "An empty lobby walks into a bar. That's the joke. That's where we are.",
  "Cool, cool, cool. Just me and the void.",
  "If a trivia host hosts in an empty room, does anyone get roasted?",
  "Calling all humans. This is not a drill. Or maybe it is. I'm bored.",
];

const IDLE_LOW: string[] = [
  "{count} player. A lonely champion. Or a lonely loser. We'll find out soon.",
  "Just {count} so far. Tell your friends. Beg if you have to.",
  "{count} brave soul. Reminds me of my last birthday party.",
  "We've got {count}. The code is {code}. Pass it around like gossip.",
  "{count} in. That's a start. Barely.",
  "{count} player. The chosen one. Or the only one who could find the link.",
  "{count} so far. Quality over quantity, right? Right?",
  "Look at you, {count} strong. A small but mighty army.",
  "{count} brave enough to show up. Respect. Sort of.",
];

const IDLE_MID: string[] = [
  "{count} players in. Not bad. Not great. Let's get more.",
  "{count} of you ready to lose with dignity. Beautiful.",
  "We're at {count}. Round it up. I don't trust odd numbers.",
  "{count} players. Code is {code}. Stragglers, this is your moment.",
  "{count} contestants. Decent turnout. Could be better. No pressure.",
  "{count} in the room. Half of you look way too confident.",
  "We're at {count}. Tell that one friend who always claims to be smart.",
  "{count} players warming up. I see at least two of you Googling already.",
  "{count} ready to rumble. Or stand awkwardly. Same thing here.",
];

const IDLE_HIGH: string[] = [
  "{count} players! Now we're cooking. One more, then we go.",
  "Look at this crowd — {count} strong. Somebody's getting humbled tonight.",
  "{count} contestants warming up. I can smell the desperation already.",
  "{count} in the lobby. Hope you stretched. There will be tears.",
  "{count} of you! This is a real party now. A sad, competitive party.",
  "{count} brains assembled. Probably six functional ones. We'll see.",
  "{count} players. The lobby is full. The egos are fuller.",
  "{count} in. I have not seen a crowd this hyped since the last fire drill.",
  "{count} contestants. Choose your enemies wisely.",
];

const IDLE_GENERIC: string[] = [
  "Tick tock. I'm not getting any younger and neither is this trivia.",
  "Come on, the code is right there — {code}. Four letters. You got this.",
  "Any day now, friends. Any day now.",
  "I've waited longer for pizza. Get in here.",
  "If we wait any longer I'm gonna start asking questions to myself.",
  "Whoever's still typing their nickname — there's no prize for creativity.",
  "Last call for the bathroom break. Truly.",
  "I'm running out of small talk. And patience.",
  "The code is {code}. Yes, still. It hasn't changed in the last ten seconds.",
  "If you're stalling because you're nervous — fair. Also, get in.",
  "Stretch a hamstring. Crack a knuckle. Anything. We're so close.",
  "I'd start a podcast in the time it's taking some of you to type a nickname.",
  "Whoever's debating between two nicknames — they're both bad. Pick one.",
  "I can hear you scrolling. Pick the dumb one. Commit.",
  "Final boarding call. Doors closing soonish. Eventually. Hopefully.",
];



function fill(line: string, count: number, code: string): string {
  return line.replaceAll("{count}", String(count)).replaceAll("{code}", code);
}

/**
 * Pick a lobby quip that hasn't been used recently.
 * `history` is an array of recently-spoken lines (raw, pre-fill). Last ~3 entries
 * are excluded. Caller is responsible for pushing the returned raw line onto history.
 */
export function pickLobbyLine(
  history: string[],
  count: number,
  code: string,
): { spoken: string; raw: string } {
  let pool: string[];
  if (count === 0) pool = [...IDLE_EMPTY, ...IDLE_GENERIC];
  else if (count <= 2) pool = [...IDLE_LOW, ...IDLE_GENERIC];
  else if (count <= 5) pool = [...IDLE_MID, ...IDLE_GENERIC];
  else pool = [...IDLE_HIGH, ...IDLE_GENERIC];

  const recent = new Set(history.slice(-3));
  const fresh = pool.filter((l) => !recent.has(l));
  const choices = fresh.length > 0 ? fresh : pool;
  const raw = choices[Math.floor(Math.random() * choices.length)];
  return { spoken: fill(raw, count, code), raw };
}

export function pickOpener(): string {
  return OPENER_LINES[Math.floor(Math.random() * OPENER_LINES.length)];
}

/**
 * Returns spoken-form versions of every lobby line so the Elf voice cache can
 * prewarm them. Uses representative `{count}` samples (0, 1, 4, 8) so the
 * prewarmed strings hit the same cache keys the runtime tick will use.
 */
export function getPrewarmLobbyLines(code: string): string[] {
  const samples = [0, 1, 4, 8];
  const out = new Set<string>();
  for (const line of OPENER_LINES) out.add(fill(line, 0, code));
  const pools = [IDLE_EMPTY, IDLE_LOW, IDLE_MID, IDLE_HIGH, IDLE_GENERIC];
  for (let i = 0; i < pools.length; i++) {
    const count = samples[Math.min(i, samples.length - 1)];
    for (const line of pools[i]) out.add(fill(line, count, code));
  }
  return Array.from(out);
}
