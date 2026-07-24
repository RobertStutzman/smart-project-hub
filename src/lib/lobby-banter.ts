// Lobby announcer banter — opener + rotating idle quips while waiting for players.
// Lines may contain `{count}` (current player count) and `{code}` (room code) tokens.
import { isAdultMode } from "@/lib/adult-mode";
import {
  pickLobbyLineAdult,
  pickOpenerAdult,
  pickWelcomeIntroAdult,
} from "@/lib/lobby-banter.adult";
import {
  EXTRA_OPENER_LINES,
  EXTRA_IDLE_EMPTY,
  EXTRA_IDLE_LOW,
  EXTRA_IDLE_MID,
  EXTRA_IDLE_HIGH,
  EXTRA_IDLE_GENERIC,
  EXTRA_IDLE_JOIN_NUDGE,
  EXTRA_WELCOME_INTROS,
} from "@/lib/lobby-banter.extra";

export const OPENER_LINES: string[] = [
  "Scan the QR code on screen, or type the four-letter code to join.",
  "Point your camera at the QR code — or punch in the code on screen. Let's get you in.",
  "Phones up: scan the QR, or type the code. That's your ticket in.",
  "Grab your phone, scan that QR code, and hop in the lobby.",
  "Scan the code on screen — QR or four letters, your call.",
  ...EXTRA_OPENER_LINES,
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
  "Any day now, friends. Any day now.",
  "I've waited longer for pizza. Get in here.",
  "If we wait any longer I'm gonna start asking questions to myself.",
  "Whoever's still typing their nickname — there's no prize for creativity.",
  "Last call for the bathroom break. Truly.",
  "I'm running out of small talk. And patience.",
  "If you're stalling because you're nervous — fair. Also, get in.",
  "Stretch a hamstring. Crack a knuckle. Anything. We're so close.",
  "I'd start a podcast in the time it's taking some of you to type a nickname.",
  "Whoever's debating between two nicknames — they're both bad. Pick one.",
  "I can hear you scrolling. Pick the dumb one. Commit.",
  "Final boarding call. Doors closing soonish. Eventually. Hopefully.",
];

// Lines that explicitly nudge people to scan / type the code. Only mixed in
// when the lobby is still empty — once anyone has joined, they obviously
// already found the code and don't need to hear it again.
const IDLE_JOIN_NUDGE: string[] = [
  "Come on, the code is right there — {code}. Four letters. You got this.",
  "The code is {code}. Yes, still. It hasn't changed in the last ten seconds.",
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
  if (isAdultMode()) return pickLobbyLineAdult(history, count, code);
  let pool: string[];
  if (count === 0) pool = [...IDLE_EMPTY, ...IDLE_JOIN_NUDGE, ...IDLE_GENERIC];
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
  if (isAdultMode()) return pickOpenerAdult();
  return OPENER_LINES[Math.floor(Math.random() * OPENER_LINES.length)];
}

// Full "welcome to the show" intros spoken by The Elf at the top of the
// lobby. Kept short (~6–12 words) so the queued line clears quickly and
// the join-instructions opener can follow without an awkward dead beat.
export const WELCOME_INTROS: string[] = [
  "Welcome to Beat the Drop — the trivia show where confidence goes to die.",
  "Lights up. It's Beat the Drop. The only trivia game with a body count.",
  "You're tuned in to Beat the Drop. Brains optional. Bravery required.",
  "Beat the Drop, baby. Where your friends find out what you don't know.",
  "Welcome, welcome, welcome to Beat the Drop. Bring snacks. Bring shame.",
  "It's Beat the Drop. Trivia's loudest, meanest, most beautiful disaster.",
  "Beat the Drop is live. Brains in, egos out, nobody leaves clean.",
  "Roll the lights. It's Beat the Drop — the show that turns friends into rivals.",
  "Welcome to Beat the Drop. Twenty questions. One survivor. Zero mercy.",
  "Beat the Drop, coming at you hot. Don't blink. Don't think too hard.",
  "Tonight, on Beat the Drop — somebody peaks, somebody panics. Let's find out which.",
  "Welcome in to Beat the Drop, where the questions hit harder than the punchlines.",
  "It's showtime on Beat the Drop. The only thing dropping faster is your dignity.",
  "Beat the Drop. The trivia game your group chat will argue about for days.",
];

export function pickWelcomeIntro(): string {
  if (isAdultMode()) return pickWelcomeIntroAdult();
  return WELCOME_INTROS[Math.floor(Math.random() * WELCOME_INTROS.length)];
}
