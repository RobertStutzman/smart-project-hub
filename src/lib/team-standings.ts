// Pure, framework-free team-scoring logic. Shared by the results screen, the
// live host leaderboard, and the server-side winner computation so all three
// agree on how a team wins. No Supabase / React imports here — just data in,
// standings out — so it can be unit-tested in isolation.

export type TeamId = "red" | "blue";

export interface TeamPlayerLite {
  team: TeamId | null;
  score: number;
  is_audience?: boolean | null;
}

export interface TeamStanding {
  team: TeamId;
  /** Sum of member scores. */
  total: number;
  /** Number of non-audience members. */
  members: number;
  /** total / members, rounded. 0 when the team has no members. */
  average: number;
}

export interface TeamResult {
  red: TeamStanding;
  blue: TeamStanding;
  /**
   * Winning team by the chosen metric, or null on an exact tie.
   * See `metric` for which value decided it.
   */
  winner: TeamId | null;
  /** Which metric decided the winner. */
  metric: "average" | "total";
  /** True when both teams tied on BOTH average and total. */
  tie: boolean;
}

const EMPTY = (team: TeamId): TeamStanding => ({ team, total: 0, members: 0, average: 0 });

/**
 * Compute red/blue standings from a player list.
 *
 * Design choice: the HEADLINE winner is decided by AVERAGE points per player,
 * not total. Team assignment auto-balances on join, but players leaving can
 * leave teams uneven — average keeps a 3-person team from beating a 4-person
 * team purely on headcount. Total is still returned for display and is used as
 * the tiebreaker when averages are exactly equal.
 *
 * Audience members (is_audience) and unassigned players (team == null) are
 * excluded.
 */
export function computeTeamStandings(players: TeamPlayerLite[]): TeamResult {
  const red = EMPTY("red");
  const blue = EMPTY("blue");

  for (const p of players) {
    if (p.is_audience) continue;
    if (p.team !== "red" && p.team !== "blue") continue;
    const bucket = p.team === "red" ? red : blue;
    bucket.total += Math.max(0, Math.round(p.score ?? 0));
    bucket.members += 1;
  }

  red.average = red.members > 0 ? Math.round(red.total / red.members) : 0;
  blue.average = blue.members > 0 ? Math.round(blue.total / blue.members) : 0;

  // Decide the winner: average first, total as tiebreaker.
  let winner: TeamId | null;
  let metric: "average" | "total";
  if (red.average !== blue.average) {
    winner = red.average > blue.average ? "red" : "blue";
    metric = "average";
  } else if (red.total !== blue.total) {
    winner = red.total > blue.total ? "red" : "blue";
    metric = "total";
  } else {
    winner = null;
    metric = "average";
  }

  // A real tie only when a team actually exists on both sides. If one side has
  // no members, the other wins by default (unless both are empty).
  const bothEmpty = red.members === 0 && blue.members === 0;
  if (winner === null && !bothEmpty) {
    // Averages and totals equal but both teams have members → genuine tie.
    return { red, blue, winner: null, metric, tie: true };
  }
  if (bothEmpty) {
    return { red, blue, winner: null, metric, tie: false };
  }
  // If exactly one side is empty, force the winner to the populated side.
  if (red.members === 0 && blue.members > 0) winner = "blue";
  if (blue.members === 0 && red.members > 0) winner = "red";

  return { red, blue, winner, metric, tie: false };
}

/** Display label for a team. */
export function teamLabel(team: TeamId): string {
  return team === "red" ? "Red" : "Blue";
}
