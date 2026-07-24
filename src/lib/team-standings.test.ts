import { describe, it, expect } from "vitest";
import { computeTeamStandings } from "./team-standings";

describe("computeTeamStandings", () => {
  it("even teams: higher scores win on average", () => {
    const r = computeTeamStandings([
      { team: "red", score: 100 },
      { team: "red", score: 200 },
      { team: "blue", score: 50 },
      { team: "blue", score: 100 },
    ]);
    expect(r.winner).toBe("red");
    expect(r.metric).toBe("average");
  });

  it("uneven teams: average decides, not total (headcount can't win it)", () => {
    // red: 2 players avg 300, total 600. blue: 3 players avg 200, total 600.
    const r = computeTeamStandings([
      { team: "red", score: 300 },
      { team: "red", score: 300 },
      { team: "blue", score: 200 },
      { team: "blue", score: 210 },
      { team: "blue", score: 190 },
    ]);
    expect(r.red.total).toBe(600);
    expect(r.blue.total).toBe(600);
    expect(r.winner).toBe("red");
    expect(r.metric).toBe("average");
  });

  it("equal averages fall back to total as tiebreaker", () => {
    const r = computeTeamStandings([
      { team: "red", score: 100 },
      { team: "red", score: 100 },
      { team: "blue", score: 100 },
    ]);
    expect(r.metric).toBe("total");
    expect(r.winner).toBe("red");
    expect(r.tie).toBe(false);
  });

  it("identical average and total is a genuine tie", () => {
    const r = computeTeamStandings([
      { team: "red", score: 100 },
      { team: "blue", score: 100 },
    ]);
    expect(r.winner).toBeNull();
    expect(r.tie).toBe(true);
  });

  it("one empty team means the other wins by default (not a tie)", () => {
    const r = computeTeamStandings([
      { team: "red", score: 100 },
      { team: "red", score: 50 },
    ]);
    expect(r.winner).toBe("red");
    expect(r.tie).toBe(false);
    expect(r.blue.members).toBe(0);
  });

  it("excludes audience and unassigned players", () => {
    const r = computeTeamStandings([
      { team: "red", score: 100 },
      { team: "blue", score: 999, is_audience: true },
      { team: null, score: 999 },
      { team: "blue", score: 80 },
    ]);
    expect(r.red.members).toBe(1);
    expect(r.blue.members).toBe(1);
    expect(r.blue.total).toBe(80);
  });

  it("clamps negative scores to zero", () => {
    const r = computeTeamStandings([
      { team: "red", score: -50 },
      { team: "blue", score: 100 },
    ]);
    expect(r.red.total).toBe(0);
    expect(r.winner).toBe("blue");
  });
});
