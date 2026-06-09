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
];

const IDLE_LOW: string[] = [
  "{count} player. A lonely champion. Or a lonely loser. We'll find out soon.",
  "Just {count} so far. Tell your friends. Beg if you have to.",
  "{count} brave soul. Reminds me of my last birthday party.",
  "We've got {count}. The code is {code}. Pass it around like gossip.",
];

const IDLE_MID: string[] = [
  "{count} players in. Not bad. Not great. Let's get more.",
  "{count} of you ready to lose with dignity. Beautiful.",
  "We're at {count}. Round it up. I don't trust odd numbers.",
  "{count} players. Code is {code}. Stragglers, this is your moment.",
];

const IDLE_HIGH: string[] = [
  "{count} players! Now we're cooking. One more, then we go.",
  "Look at this crowd — {count} strong. Somebody's getting humbled tonight.",
  "{count} contestants warming up. I can smell the desperation already.",
  "{count} in the lobby. Hope you stretched. There will be tears.",
];

const IDLE_GENERIC: string[] = [
  "Tick tock. I'm not getting any younger and neither is this trivia.",
  "Come on, the code is right there — {code}. Four letters. You got this.",
  "Any day now, friends. Any day now.",
  "I've waited longer for pizza. Get in here.",
  "If we wait any longer I'm gonna start asking questions to myself.",
  "Whoever's still typing their nickname — there's no prize for creativity.",
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
