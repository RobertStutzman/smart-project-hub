// Quips the announcer says after welcoming a newly-joined player.
// Keep them short, punchy, and family-safe-ish. Picked at random per join.

export const JOIN_QUIPS: string[] = [
  "Welcome to the chaos.",
  "Hope you brought brain cells.",
  "Try not to embarrass yourself.",
  "Another challenger emerges.",
  "Bold of you to assume you'll win.",
  "Big talk for someone who just got here.",
  "Buckle up.",
  "We've been waiting for you.",
  "Try to keep up.",
  "Don't be the wooden spoon.",
  "Last one in does the dishes.",
  "Showtime.",
  "Pray to the trivia gods.",
  "Get ready to lose to your friends.",
  "Your reputation precedes you. Tragically.",
  "Hands warm? Brain on?",
  "May the bracket be ever in your favor.",
  "Don't choke.",
  "I have a good feeling about this one. I'm lying.",
  "The leaderboard is watching.",
  "Coffee's gone, knowledge stays.",
  "Welcome to the dropzone.",
  "Easy mode? Not here.",
  "Try not to peek at your neighbor's phone.",
  "The mic is hot. The questions are hotter.",
  "Glad you could make it. Eventually.",
  "Took you long enough.",
  "Hope you stretched your thumbs.",
  "Just don't be that player.",
  "Welcome, victim — I mean, challenger.",
];

export function pickQuip(seed?: string): string {
  if (!seed) return JOIN_QUIPS[Math.floor(Math.random() * JOIN_QUIPS.length)];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return JOIN_QUIPS[Math.abs(h) % JOIN_QUIPS.length];
}
