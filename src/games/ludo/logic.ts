// Ludo game logic — server-validated state shape and pure helpers.
// Board is the standard 52-cell main track + 6 home column cells per color.
// Token positions:
//   -1  = at base (home yard)
//   0..51 = on main track (each color has its own start offset)
//   100..105 = home column cells (player-relative; 100 entry, 105 finish)
//   106 = finished
//
// We store positions as the player's own track index for simplicity:
//   For player k, their absolute start cell = k * 13.

export type LudoColor = "red" | "blue" | "yellow" | "green";
export const COLORS: LudoColor[] = ["red", "blue", "yellow", "green"];

export interface LudoPlayer {
  user_id: string;
  color: LudoColor;
  // 4 tokens; each value is "track index" relative to that player (0..51 main, 100..106 home column)
  tokens: number[];
}

export interface LudoState {
  version: 1;
  players: LudoPlayer[];
  turnIdx: number;          // index into players[]
  dice: number | null;      // last roll
  rollsLeft: number;        // for 6 -> extra roll
  lastEvent?: { type: string; payload?: any; ts: number };
  winnerOrder: string[];    // user_ids in finishing order
}

export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // global cells safe (relative to absolute board)

export function initLudoState(player_ids: string[]): LudoState {
  const colorOrder: LudoColor[] = player_ids.length === 2 ? ["red", "yellow"] :
    player_ids.length === 3 ? ["red", "blue", "yellow"] : COLORS;
  return {
    version: 1,
    players: player_ids.map((id, i) => ({
      user_id: id,
      color: colorOrder[i] ?? COLORS[i % 4],
      tokens: [-1, -1, -1, -1],
    })),
    turnIdx: 0,
    dice: null,
    rollsLeft: 1,
    winnerOrder: [],
  };
}

// Convert a token's player-relative position to absolute board cell (0..51), or null if not on main track.
export function toAbsolute(playerIdx: number, pos: number, totalPlayers: number): number | null {
  if (pos < 0 || pos >= 100) return null;
  // 4-color positions are spaced 13 cells apart on a 52-cell loop. 2-player and 3-player keep same offsets.
  const startOffsets: Record<LudoColor, number> = { red: 0, blue: 13, yellow: 26, green: 39 };
  // We'll derive absolute from color, not from playerIdx
  return null; // computed via player.color externally
}

export function colorStart(color: LudoColor): number {
  return ({ red: 0, blue: 13, yellow: 26, green: 39 } as const)[color];
}

export function absoluteCell(player: LudoPlayer, tokenPos: number): number | null {
  if (tokenPos < 0 || tokenPos >= 100) return null;
  return (colorStart(player.color) + tokenPos) % 52;
}

// Determine which tokens of the current player can move with the rolled dice.
export function legalMoves(state: LudoState, dice: number): number[] {
  const player = state.players[state.turnIdx];
  const moves: number[] = [];
  player.tokens.forEach((pos, i) => {
    if (pos === 106) return; // finished
    if (pos === -1) {
      if (dice === 6) moves.push(i);
      return;
    }
    if (pos < 51) {
      // moving along main track
      if (pos + dice <= 56) moves.push(i); // up to entering home column at 51 -> 100..105
      return;
    }
    if (pos === 51) {
      // about to enter home column with any dice, max 5 steps in
      if (dice <= 6) moves.push(i);
      return;
    }
    if (pos >= 100 && pos < 106) {
      const remaining = 105 - pos;
      if (dice <= remaining + 1) moves.push(i);
    }
  });
  return moves;
}

export interface MoveResult {
  newState: LudoState;
  captured: { user_id: string; tokenIdx: number }[];
  reachedHome: boolean;
  finishedGame: boolean;
  extraTurn: boolean;
}

// Apply a move (no validation of turn — caller verifies).
export function applyMove(state: LudoState, tokenIdx: number, dice: number): MoveResult {
  const next: LudoState = JSON.parse(JSON.stringify(state));
  const player = next.players[next.turnIdx];
  const captured: { user_id: string; tokenIdx: number }[] = [];
  let reachedHome = false;
  let extraTurn = dice === 6;

  let pos = player.tokens[tokenIdx];
  if (pos === -1) {
    // enter board on color start
    pos = 0;
  } else if (pos < 51) {
    pos = pos + dice;
    if (pos > 51) {
      // overshoot enters home column
      const over = pos - 51;
      pos = 100 + (over - 1); // first step into home col = 100
    }
  } else if (pos === 51) {
    // step into home col
    pos = 100 + (dice - 1);
  } else if (pos >= 100 && pos < 106) {
    pos = pos + dice;
  }

  if (pos > 105) pos = 106; // finish
  if (pos === 106) {
    reachedHome = true;
    extraTurn = true;
  }
  player.tokens[tokenIdx] = pos;

  // Captures: only on main-track absolute cells, not on safe cells
  if (pos >= 0 && pos < 100) {
    const abs = absoluteCell(player, pos);
    if (abs !== null && !SAFE_CELLS.has(abs)) {
      next.players.forEach((other) => {
        if (other.user_id === player.user_id) return;
        other.tokens.forEach((otherPos, i) => {
          if (otherPos < 0 || otherPos >= 100) return;
          const oa = absoluteCell(other, otherPos);
          if (oa === abs) {
            other.tokens[i] = -1;
            captured.push({ user_id: other.user_id, tokenIdx: i });
            extraTurn = true;
          }
        });
      });
    }
  }

  // Check finish
  const allHome = player.tokens.every((t) => t === 106);
  let finishedGame = false;
  if (allHome) {
    if (!next.winnerOrder.includes(player.user_id)) next.winnerOrder.push(player.user_id);
    const remaining = next.players.filter((p) => !next.winnerOrder.includes(p.user_id));
    if (remaining.length <= 1) {
      // game over
      if (remaining.length === 1) next.winnerOrder.push(remaining[0].user_id);
      finishedGame = true;
    }
  }

  next.dice = null;
  next.rollsLeft = extraTurn && !finishedGame ? 1 : 0;
  next.lastEvent = { type: "move", payload: { tokenIdx, dice, captured: captured.length, reachedHome }, ts: Date.now() };
  return { newState: next, captured, reachedHome, finishedGame, extraTurn };
}

// Pass turn to next non-finished player.
export function nextTurn(state: LudoState): LudoState {
  const next: LudoState = JSON.parse(JSON.stringify(state));
  const n = next.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (next.turnIdx + i) % n;
    if (!next.winnerOrder.includes(next.players[idx].user_id)) {
      next.turnIdx = idx;
      next.dice = null;
      next.rollsLeft = 1;
      return next;
    }
  }
  return next;
}

export function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}
