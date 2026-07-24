// Extra lobby banter pools. Merged into lobby-banter.ts at module load so
// the persona baker isn't touched — new lines flow through the same
// pickLobbyLine/pickOpener flow.

export const EXTRA_OPENER_LINES: string[] = [
  "Camera up, code on screen. Scan it, or punch four letters. That easy.",
  "You want in? Point that phone at the QR. Or type the code like it's 1998.",
  "Every phone in the room, at the screen. Scan or type. Pick a lane.",
  "Doors are open. Scan the QR. Type the code. Get your nickname in.",
  "That QR is not going to scan itself. That's on you.",
  "Four-letter code or QR. Choose your fighter.",
  "Room's live. Code's up. Move.",
  "Scan, type, join, name yourself something stupid. Standard flow.",
  "Fresh room, fresh code. Get in before I start without you.",
  "Phones out, thumbs ready, dignity optional. Scan and go.",
];

export const EXTRA_IDLE_EMPTY: string[] = [
  "Empty room, full mic. Awkward.",
  "Nobody in. Fine. I'll monologue.",
  "Zero players. This is the trivia version of a haunted mall.",
  "I could hear a pin drop, if any of you were here to drop one.",
  "Room count: nada. Vibe count: sad.",
  "The lobby's a graveyard. Charming.",
  "Just me, the code, and the crushing silence.",
  "Come on — one brave soul. Any brave soul.",
  "Population zero. Ambition also zero.",
  "The chairs are ready. The chairs are willing. The chairs are lonely.",
];

export const EXTRA_IDLE_LOW: string[] = [
  "{count} in the door. Barely enough to have opinions.",
  "{count} player. Very intimate trivia experience tonight.",
  "{count} showed up. Somewhere out there, several friends are being disloyal.",
  "{count} contestant. Highly personal. Highly awkward. Let's go.",
  "{count} joined. That's technically a party.",
  "{count} in. Code is {code}. Text it to the group chat and shame the stragglers.",
];

export const EXTRA_IDLE_MID: string[] = [
  "{count} players. Solid. Not spectacular. Get more.",
  "{count} in the lobby. Warming up. Sweating slightly.",
  "{count} contestants ready. Where's the rest of the group?",
  "{count} players. I've seen worse. I've seen better.",
  "{count} in. Code is {code} — share it with anyone still stalling.",
  "{count} strong. Fine turnout. Would be a great turnout at ten.",
];

export const EXTRA_IDLE_HIGH: string[] = [
  "{count} contestants! Room's packed. Egos packed tighter.",
  "{count} of you. Somebody's about to be humbled in front of a crowd.",
  "{count} players. This is what trivia was made for.",
  "{count} in. Full house. Full disaster.",
  "{count} brains in the room. Half of them functional. Optimistic estimate.",
  "{count} strong. This is going to be a bloodbath. A polite one.",
];

export const EXTRA_IDLE_GENERIC: string[] = [
  "Come on. Any second now.",
  "I'm not paid by the hour. Sadly.",
  "Every second you wait, the questions get meaner. Not true. But it feels true.",
  "This is prime buffer-and-stall time. Don't waste it.",
  "Whoever is doing hair — you look fine. Get in.",
  "Whoever is on the toilet — respectable timing.",
  "Whoever is arguing about a nickname — pick the dumb one. Always the dumb one.",
  "Fashionably late is not a personality. It's a delay.",
  "I could read the entire question bank in this pause. I won't. But I could.",
  "Anyone still in the parking lot? Move.",
];

export const EXTRA_IDLE_JOIN_NUDGE: string[] = [
  "Code's {code}. Four letters. Even you can manage that.",
  "The code is right there — {code}. Type it. Live your dreams.",
  "Still empty. Still {code}. Still waiting.",
];

export const EXTRA_WELCOME_INTROS: string[] = [
  "Welcome to Beat the Drop, where the buzzer is meaner than your group chat.",
  "It's Beat the Drop — the trivia game with a stopwatch and a grudge.",
  "Beat the Drop, live and unpolished. Bring brains. Bring backup.",
  "You're in Beat the Drop — trivia's answer to spectator sport violence.",
  "Beat the Drop, the show that turns 'I knew that' into a full identity crisis.",
  "Welcome to Beat the Drop. Twenty-one questions. One trophy. Countless grievances.",
  "It's Beat the Drop, folks — trivia with teeth.",
  "Welcome in. This is Beat the Drop. Every buzzer counts. Every silence hurts.",
  "Beat the Drop: because your friends deserve to know what you don't.",
  "Live at whatever bar or living room you're in — it's Beat the Drop.",
];
