// Cricket — turn-based timing game with realistic outcome distribution.
// Each "ball": bowler picks speed (slow/med/fast) + line (off/middle/leg).
// Batter picks shot type (defend/drive/pull/loft) + timing (0..100, perfect=100).
// Outcome resolved deterministically from inputs + a small RNG.

export type ShotType = "defend" | "drive" | "pull" | "loft";
export type BallSpeed = "slow" | "medium" | "fast";
export type BallLine = "off" | "middle" | "leg";

export interface CricketBall {
  speed: BallSpeed;
  line: BallLine;
  shot?: ShotType;
  timing?: number;
  result?: BallResult;
}

export interface BallResult {
  runs: number;
  wicket: boolean;
  extra?: "wide";
  description: string;
}

export interface InningsState {
  battingId: string;
  bowlingId: string;
  runs: number;
  wickets: number;
  ballsBowled: number;     // legal balls
  balls: CricketBall[];    // history
  target?: number;         // for chasing innings
}

export interface CricketState {
  version: 1;
  player_ids: string[];
  overs: number;
  toss: { winnerId: string; choice: "bat" | "bowl" } | null;
  innings: number;          // 1 or 2
  innings1: InningsState | null;
  innings2: InningsState | null;
  // Per-ball pending inputs
  pendingBowl: CricketBall | null;
  // Whose turn to act: bowler picks first, then batter
  awaitingBatter: boolean;
  result?: { winnerId: string | null; margin: string };
  lastBall?: BallResult & { ts: number };
}

export function initCricketState(player_ids: string[], overs: number): CricketState {
  return {
    version: 1,
    player_ids,
    overs,
    toss: null,
    innings: 1,
    innings1: null,
    innings2: null,
    pendingBowl: null,
    awaitingBatter: false,
  };
}

export function totalLegalBalls(overs: number) { return overs * 6; }

// Resolve a ball given full inputs.
export function resolveBall(b: CricketBall): BallResult {
  if (!b.shot || b.timing == null) {
    // wide if batter doesn't act? we treat as dot ball; not used in flow
    return { runs: 0, wicket: false, description: "Dot ball" };
  }
  const t = b.timing; // 0..100
  // Match score: how well shot suits the ball
  let suitability = 0.5;
  if (b.shot === "defend") suitability = 0.9; // hard to mistime fatally
  if (b.shot === "drive") {
    suitability = b.line === "off" ? 0.8 : b.line === "middle" ? 0.7 : 0.5;
  }
  if (b.shot === "pull") {
    suitability = b.line === "leg" ? 0.85 : b.line === "middle" ? 0.65 : 0.4;
    if (b.speed === "fast") suitability += 0.05;
  }
  if (b.shot === "loft") {
    suitability = b.speed === "slow" ? 0.85 : b.speed === "medium" ? 0.6 : 0.35;
  }

  // Effective timing window — shrinks with speed and shot risk
  const window = b.shot === "defend" ? 40 : b.shot === "drive" ? 28 : b.shot === "pull" ? 24 : 18;
  const speedPenalty = b.speed === "fast" ? 6 : b.speed === "medium" ? 3 : 0;
  const effective = Math.max(0, t - (50 - window / 2)) / window; // 0..1
  const timingScore = Math.max(0, Math.min(1, effective)) * suitability - speedPenalty / 100;

  const r = Math.random();

  // Wicket chance: low timing on aggressive shots
  if (b.shot !== "defend") {
    const wicketChance = (b.shot === "loft" ? 0.22 : b.shot === "pull" ? 0.16 : 0.10) * (1 - timingScore);
    if (r < wicketChance) {
      const desc = b.shot === "loft" ? "Caught at long-on!" : b.shot === "pull" ? "Top edge — caught!" : "Edged behind — out!";
      return { runs: 0, wicket: true, description: desc };
    }
  }

  // Determine runs based on timing & shot
  if (b.shot === "defend") {
    if (timingScore > 0.7) return { runs: r < 0.2 ? 1 : 0, wicket: false, description: r < 0.2 ? "Pushed for a single" : "Solid defence" };
    if (timingScore > 0.4) return { runs: 0, wicket: false, description: "Defended" };
    return { runs: 0, wicket: false, description: "Played and missed" };
  }

  if (b.shot === "drive") {
    if (timingScore > 0.85) return { runs: 4, wicket: false, description: "Stunning drive — FOUR!" };
    if (timingScore > 0.65) return { runs: r < 0.3 ? 4 : 2, wicket: false, description: r < 0.3 ? "Driven to the fence!" : "Two runs" };
    if (timingScore > 0.4) return { runs: r < 0.5 ? 1 : 0, wicket: false, description: r < 0.5 ? "Pushed for one" : "Mistimed drive" };
    return { runs: 0, wicket: false, description: "Mistimed" };
  }

  if (b.shot === "pull") {
    if (timingScore > 0.85) return { runs: 6, wicket: false, description: "Massive pull — SIX!" };
    if (timingScore > 0.65) return { runs: 4, wicket: false, description: "Pulled to the rope!" };
    if (timingScore > 0.4) return { runs: r < 0.5 ? 2 : 1, wicket: false, description: "A couple of runs" };
    return { runs: 0, wicket: false, description: "Mistimed pull" };
  }

  // loft
  if (timingScore > 0.85) return { runs: 6, wicket: false, description: "Lofted — SIX!" };
  if (timingScore > 0.6) return { runs: 4, wicket: false, description: "Cleared the infield — FOUR!" };
  if (timingScore > 0.35) return { runs: r < 0.5 ? 2 : 1, wicket: false, description: "In the gap" };
  return { runs: 0, wicket: false, description: "Skied but no run" };
}

// Apply a finalized ball result to current innings, returns new state.
export function applyBall(state: CricketState, ball: CricketBall, result: BallResult): CricketState {
  const next: CricketState = JSON.parse(JSON.stringify(state));
  const innings = next.innings === 1 ? next.innings1! : next.innings2!;
  innings.balls.push({ ...ball, result });
  innings.runs += result.runs;
  if (!result.extra) innings.ballsBowled += 1;
  if (result.wicket) innings.wickets += 1;
  next.lastBall = { ...result, ts: Date.now() };
  next.pendingBowl = null;
  next.awaitingBatter = false;

  const total = totalLegalBalls(next.overs);
  const inningsOver = innings.wickets >= 2 || innings.ballsBowled >= total ||
    (innings === next.innings2 && next.innings1 && innings.runs > next.innings1.runs);

  if (inningsOver) {
    if (next.innings === 1) {
      next.innings = 2;
      next.innings2 = {
        battingId: innings.bowlingId,
        bowlingId: innings.battingId,
        runs: 0, wickets: 0, ballsBowled: 0, balls: [],
        target: innings.runs + 1,
      };
    } else {
      // match over
      const r1 = next.innings1!.runs, r2 = next.innings2!.runs;
      let winnerId: string | null = null;
      let margin = "Tied";
      if (r2 > r1) {
        winnerId = next.innings2!.battingId;
        margin = `Won by ${2 - next.innings2!.wickets} wickets`;
      } else if (r1 > r2) {
        winnerId = next.innings1!.battingId;
        margin = `Won by ${r1 - r2} runs`;
      }
      next.result = { winnerId, margin };
    }
  }
  return next;
}

export function setToss(state: CricketState, winnerId: string, choice: "bat" | "bowl"): CricketState {
  const next: CricketState = JSON.parse(JSON.stringify(state));
  next.toss = { winnerId, choice };
  const otherId = state.player_ids.find((id) => id !== winnerId)!;
  const battingId = choice === "bat" ? winnerId : otherId;
  const bowlingId = choice === "bat" ? otherId : winnerId;
  next.innings1 = { battingId, bowlingId, runs: 0, wickets: 0, ballsBowled: 0, balls: [] };
  return next;
}

export function currentBatterBowler(state: CricketState): { battingId: string; bowlingId: string } | null {
  const innings = state.innings === 1 ? state.innings1 : state.innings2;
  if (!innings) return null;
  return { battingId: innings.battingId, bowlingId: innings.bowlingId };
}

export function inningsScoreText(innings: InningsState | null, overs: number): string {
  if (!innings) return "—";
  const o = Math.floor(innings.ballsBowled / 6);
  const b = innings.ballsBowled % 6;
  return `${innings.runs}/${innings.wickets} (${o}.${b}/${overs})`;
}
