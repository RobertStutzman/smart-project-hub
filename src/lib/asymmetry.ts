// Asymmetry rounds — one per game, slot 8–17 (excluding wildcard slots 10/15).
// Phase 1: foundation only — picks slot + format deterministically per game,
// loads a prompt, shows an intro phase with announcer explainer, then auto-
// advances back to a normal question. Submit/vote/scoring lands in phase 2/3.

export type AsymFormat =
  | "crowd_pleaser"
  | "two_truths"
  | "hot_take"
  | "finish_sentence";

export const ASYM_FORMATS: AsymFormat[] = [
  "crowd_pleaser",
  "two_truths",
  "hot_take",
  "finish_sentence",
];

/** Slots eligible for an asymmetry round — Q8–Q17 minus wildcard slots 10, 15. */
export const ASYM_SLOTS: number[] = [8, 9, 11, 12, 13, 14, 16, 17];

export const ASYM_LABELS: Record<AsymFormat, string> = {
  crowd_pleaser: "Crowd-Pleaser",
  two_truths: "Two Truths & a Lie",
  hot_take: "Hot Take Defense",
  finish_sentence: "Finish The Sentence",
};

export const ASYM_TAGLINES: Record<AsymFormat, string> = {
  crowd_pleaser: "No right answer — best answer wins.",
  two_truths: "One player lies. The rest of you guess.",
  hot_take: "Pick a side. The minority wins big.",
  finish_sentence: "Type the funniest ending. Room votes.",
};

export const ASYM_EXPLAINERS: Record<AsymFormat, string[]> = {
  crowd_pleaser: [
    "Crowd Pleaser! There's no right answer here. Type your best take, then the whole room votes for the winner.",
    "Crowd Pleaser round. Best answer in the room takes the points — and bragging rights.",
  ],
  two_truths: [
    "Two Truths and a Lie! One of you is the liar tonight. Three statements go up — everyone else votes which one is fake.",
    "Two Truths and a Lie. The source writes three statements, two real, one fake. Fool the room and you win big.",
  ],
  hot_take: [
    "Hot Take Defense! A spicy statement is coming. Pick agree or disagree — the smaller side wins the most points for being brave.",
    "Hot Take round. Minority wins. Pick the side you actually believe and hope you're outnumbered.",
  ],
  finish_sentence: [
    "Finish The Sentence! A setup goes on screen, you type the funniest ending you can. The room votes the winner.",
    "Finish The Sentence round. Be clever, be quick, be funny — the room decides who wins.",
  ],
};

/** Deterministic Fisher-Yates from a string seed (FNV-1a + LCG). */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = arr.slice();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickAsymSlotForRoom(roomId: string): number {
  return seededShuffle(ASYM_SLOTS, `asym-slot:${roomId}`)[0];
}

export function pickAsymFormatForRoom(roomId: string): AsymFormat {
  return seededShuffle(ASYM_FORMATS, `asym-fmt:${roomId}`)[0];
}

export function pickAsymExplainer(fmt: AsymFormat): string {
  const lines = ASYM_EXPLAINERS[fmt] ?? [];
  if (lines.length === 0) return "";
  return lines[Math.floor(Math.random() * lines.length)];
}

export type AsymSubmissionPayload = {
  text?: string;
  choice?: "agree" | "disagree";
  statements?: string[];
  lieIndex?: number;
};

/**
 * Compute per-player score deltas for an asym round. Used both server-side
 * (to persist `players.score` + `players.current_round_score`) and
 * client-side (to render the reveal animation). Stays in sync because both
 * paths import this same function.
 */
export function computeAsymDeltas(
  fmt: AsymFormat,
  liveSessionIds: string[],
  sourceSessionId: string | null,
  submissions: Record<string, AsymSubmissionPayload>,
  votes: Record<string, string | number>,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const sid of liveSessionIds) deltas[sid] = 0;

  if (fmt === "crowd_pleaser" || fmt === "finish_sentence") {
    const tally = new Map<string, number>();
    for (const v of Object.values(votes)) {
      const sid = String(v);
      tally.set(sid, (tally.get(sid) ?? 0) + 1);
    }
    let max = 0;
    tally.forEach((v) => {
      if (v > max) max = v;
    });
    if (max > 0) {
      const winners: string[] = [];
      tally.forEach((v, sid) => {
        if (v === max) winners.push(sid);
      });
      const winShare = Math.round(300 / winners.length);
      winners.forEach((sid) => {
        if (sid in deltas) deltas[sid] += winShare;
      });
      tally.forEach((v, sid) => {
        if (v > 0 && v < max && sid in deltas) deltas[sid] += 100;
      });
    }
    return deltas;
  }

  if (fmt === "two_truths") {
    if (!sourceSessionId) return deltas;
    const sub = submissions[sourceSessionId];
    if (!sub || typeof sub.lieIndex !== "number") return deltas;
    const lie = sub.lieIndex;
    let fooled = 0;
    Object.entries(votes).forEach(([voter, guess]) => {
      if (voter === sourceSessionId) return;
      const g = typeof guess === "number" ? guess : Number(guess);
      if (g === lie) {
        if (voter in deltas) deltas[voter] += 200;
      } else {
        fooled++;
      }
    });
    deltas[sourceSessionId] = Math.min(600, fooled * 100);
    return deltas;
  }

  if (fmt === "hot_take") {
    const counts = { agree: 0, disagree: 0 };
    Object.entries(submissions).forEach(([, s]) => {
      if (s.choice === "agree") counts.agree++;
      else if (s.choice === "disagree") counts.disagree++;
    });
    const tie = counts.agree === counts.disagree;
    const minority: "agree" | "disagree" | null = tie
      ? null
      : counts.agree < counts.disagree
        ? "agree"
        : "disagree";
    Object.entries(submissions).forEach(([sid, s]) => {
      if (!(sid in deltas)) return;
      if (tie) deltas[sid] += 150;
      else if (s.choice === minority) deltas[sid] += 400;
    });
    return deltas;
  }

  return deltas;
}
