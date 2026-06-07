// Registry of every Vox "moment" the host can react to.
// Read-only source of truth for the admin Sounds page.

import { LINES } from "@/lib/host-persona";

export type HostMomentTier = "baked" | "live" | "both";

export interface HostMomentMeta {
  key: string;
  label: string;
  description: string;
  tier: HostMomentTier;
  /** Baked pool key in host-persona LINES (if any). */
  bakedKey?: keyof typeof LINES;
  /** Live template count from persona-live TEMPLATES (filled in below). */
  liveCount?: number;
  /** Sample resolved text used for the Preview button. */
  sampleText: string;
}

// Live template counts mirror src/lib/persona-live.ts TEMPLATES.
// Kept here as constants so the admin UI doesn't have to import the
// browser-only persona-live module (which pulls in elf-voice / audio).
const LIVE_COUNTS: Record<string, number> = {
  first_blood: 10,
  leader_changed: 10,
  streak: 10,
  elimination: 10,
  comeback: 10,
  round_recap: 10,
  welcome: 10,
  final_showdown: 10,
  winner: 10,
};

export const HOST_MOMENTS: HostMomentMeta[] = [
  {
    key: "intro_hype",
    label: "Intro hype",
    description: "Cold open after the title card, before round one.",
    tier: "baked",
    bakedKey: "intro_hype",
    sampleText: "Buckle up. The drop is coming.",
  },
  {
    key: "welcome",
    label: "Welcome roll call",
    description: "Names 2–3 random lobby players as Round 1 begins.",
    tier: "live",
    liveCount: LIVE_COUNTS.welcome,
    sampleText: "Tonight we've got Sarah, Marcus, and Jin. May the best brain win.",
  },
  {
    key: "question_open",
    label: "Question open",
    description: "Brief zing when a brand-new question appears.",
    tier: "baked",
    bakedKey: "question_open",
    sampleText: "Lock it in.",
  },
  {
    key: "first_blood",
    label: "First blood",
    description: "First player to lock in the correct answer.",
    tier: "both",
    bakedKey: "first_blood",
    liveCount: LIVE_COUNTS.first_blood,
    sampleText: "Sarah — first in, dead on. Showoff.",
  },
  {
    key: "streak",
    label: "Streak milestone",
    description: "Player hits a 3+/5+/7+ correct streak.",
    tier: "both",
    bakedKey: "streak_milestone",
    liveCount: LIVE_COUNTS.streak,
    sampleText: "Sarah is on a 3-streak. Somebody stop them.",
  },
  {
    key: "leader_changed",
    label: "New leader",
    description: "A new player takes #1 on the leaderboard.",
    tier: "both",
    bakedKey: "leader_changed",
    liveCount: LIVE_COUNTS.leader_changed,
    sampleText: "Sarah takes the lead. The throne wobbles.",
  },
  {
    key: "comeback",
    label: "Comeback alert",
    description: "Player climbs 3+ ranks back into the top 3.",
    tier: "both",
    bakedKey: "comeback",
    liveCount: LIVE_COUNTS.comeback,
    sampleText: "Wait — Sarah climbed 4 spots. Sneaky.",
  },
  {
    key: "elimination",
    label: "Elimination",
    description: "Wrong-answer callout (throttled, 1 per question).",
    tier: "both",
    bakedKey: "elimination",
    liveCount: LIVE_COUNTS.elimination,
    sampleText: "Sarah. Out. Cold.",
  },
  {
    key: "all_correct",
    label: "All correct",
    description: "Entire room nailed the question.",
    tier: "baked",
    bakedKey: "all_correct",
    sampleText: "Look at you, all of you, correct. Suspicious.",
  },
  {
    key: "all_wrong",
    label: "All wrong",
    description: "Entire room whiffed the question.",
    tier: "baked",
    bakedKey: "all_wrong",
    sampleText: "Oof. Not a single one. Painful.",
  },
  {
    key: "split_correct",
    label: "Split correct",
    description: "Some right, some wrong — mixed bag.",
    tier: "baked",
    bakedKey: "split_correct",
    sampleText: "Half of you guessed. The other half KNEW.",
  },
  {
    key: "round_recap",
    label: "Round recap MVP",
    description: "Calls out the round's top scorer at round end.",
    tier: "both",
    bakedKey: "round_recap",
    liveCount: LIVE_COUNTS.round_recap,
    sampleText: "Round 2 belonged to Sarah. The rest of you — adjust.",
  },
  {
    key: "final_showdown",
    label: "Final showdown",
    description: "Names the top 3 contenders before the final question.",
    tier: "both",
    bakedKey: "final_hype",
    liveCount: LIVE_COUNTS.final_showdown,
    sampleText: "Sarah, Marcus, and Jin — one question between you and the crown. Don't blow it.",
  },
  {
    key: "winner",
    label: "Winner crowning",
    description: "Champion callout right after the game ends.",
    tier: "both",
    bakedKey: "credits_open",
    liveCount: LIVE_COUNTS.winner,
    sampleText: "Your winner: Sarah. Tonight, the brain reigned supreme.",
  },
  {
    key: "credits_open",
    label: "Credits / outro",
    description: "Generic show-end signoff under the credits.",
    tier: "baked",
    bakedKey: "credits_open",
    sampleText: "And that's the show. Roll credits.",
  },
];

export function bakedCount(meta: HostMomentMeta): number {
  return meta.bakedKey ? LINES[meta.bakedKey].length : 0;
}
