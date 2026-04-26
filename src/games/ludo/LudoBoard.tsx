import { useEffect, useMemo, useRef, useState } from "react";
import { Room, PlayerProfile, updateGameState, recordMatch } from "@/hooks/useRoom";
import { useAuth } from "@/hooks/useAuth";
import { applyMove, colorStart, initLudoState, legalMoves, LudoColor, LudoState, nextTurn, rollDice, SAFE_CELLS } from "./logic";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sfx } from "@/lib/sfx";
import { Trophy, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const COLOR_HEX: Record<LudoColor, string> = {
  red: "hsl(4 90% 58%)",
  blue: "hsl(217 89% 51%)",
  yellow: "hsl(45 100% 51%)",
  green: "hsl(137 55% 41%)",
};
const COLOR_SOFT: Record<LudoColor, string> = {
  red: "hsl(4 90% 95%)",
  blue: "hsl(217 89% 95%)",
  yellow: "hsl(45 100% 92%)",
  green: "hsl(137 55% 92%)",
};

// Path mapping: cell index 0..51 to (col,row) on a 15x15 grid (standard ludo path).
// Builds the cross-shaped path starting from the red entry square (col 1, row 6).
const MAIN_PATH: [number, number][] = (() => {
  const p: [number, number][] = [];
  // Red arm enters at (1,6), goes right to (5,6)
  for (let c = 1; c <= 5; c++) p.push([c, 6]);
  // up to (6,1)
  for (let r = 5; r >= 0; r--) p.push([6, r]);
  // right (7,0) (8,0)
  p.push([7, 0]);
  // down to (8,5)
  for (let r = 1; r <= 5; r++) p.push([8, r]);
  // right to (13,6)
  for (let c = 9; c <= 13; c++) p.push([c, 6]);
  // down (14,6) (14,7) (14,8)
  p.push([14, 6]);
  p.push([14, 7]);
  p.push([14, 8]);
  // left (13,8)..(9,8)
  for (let c = 13; c >= 9; c--) p.push([c, 8]);
  // down (8,9)..(8,13)
  for (let r = 9; r <= 13; r++) p.push([8, r]);
  // (8,14) (7,14) (6,14)
  p.push([8, 14]);
  p.push([7, 14]);
  p.push([6, 14]);
  // up (6,13)..(6,9)
  for (let r = 13; r >= 9; r--) p.push([6, r]);
  // left (5,8)..(1,8)
  for (let c = 5; c >= 1; c--) p.push([c, 8]);
  // (0,8) (0,7) (0,6)
  p.push([0, 8]);
  p.push([0, 7]);
  p.push([0, 6]);
  return p; // length 52
})();

// Home column for each color (5 cells leading to center) and base corner
const HOME_COLS: Record<LudoColor, [number, number][]> = {
  red:    [[1,7],[2,7],[3,7],[4,7],[5,7]],
  blue:   [[7,1],[7,2],[7,3],[7,4],[7,5]],
  green:  [[13,7],[12,7],[11,7],[10,7],[9,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9]],
};
const BASE: Record<LudoColor, [number, number]> = {
  red: [1.5, 1.5],
  blue: [10.5, 1.5],
  green: [10.5, 10.5],
  yellow: [1.5, 10.5],
};
const ENTRY_OFFSET: Record<LudoColor, number> = { red: 0, blue: 13, green: 26, yellow: 39 };

export function LudoBoard({ room, players }: { room: Room; players: PlayerProfile[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [diceRolling, setDiceRolling] = useState(false);

  const state = (room.game_state as LudoState) ?? initLudoState(room.player_ids);
  const me = state.players.find((p) => p.user_id === user?.id);
  const myTurn = state.players[state.turnIdx]?.user_id === user?.id && room.status === "playing";
  const currentPlayer = state.players[state.turnIdx];
  const currentProfile = players.find((p) => p.user_id === currentPlayer?.user_id);

  // Draw board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    drawBoard(ctx, size, state, myTurn ? state.dice : null);
  }, [state, myTurn]);

  const handleRoll = async () => {
    if (!myTurn || diceRolling) return;
    if (state.dice !== null) return; // already rolled
    setDiceRolling(true);
    sfx.dice();
    // Animated rolling
    const start = Date.now();
    const tick = async () => {
      if (Date.now() - start < 600) {
        // visual jitter handled via local state? simpler: just roll once after delay
        requestAnimationFrame(tick);
      } else {
        const value = rollDice();
        const next: LudoState = { ...state, dice: value };
        const moves = legalMoves(next, value);
        if (moves.length === 0) {
          // no moves -> pass turn
          await new Promise((r) => setTimeout(r, 600));
          const passed = nextTurn({ ...next, dice: null });
          await updateGameState(room.id, passed, passed.players[passed.turnIdx].user_id);
          toast.message(`No moves on ${value} — turn passed`);
        } else {
          await updateGameState(room.id, next, currentPlayer.user_id);
        }
        setDiceRolling(false);
      }
    };
    tick();
  };

  const handlePickToken = async (tokenIdx: number) => {
    if (!myTurn || state.dice === null) return;
    const moves = legalMoves(state, state.dice);
    if (!moves.includes(tokenIdx)) return;
    sfx.move();
    const result = applyMove(state, tokenIdx, state.dice);
    if (result.captured.length) sfx.capture();

    let nextState = result.newState;
    let nextTurnId = currentPlayer.user_id;

    if (result.finishedGame) {
      const winner = nextState.winnerOrder[0];
      await updateGameState(room.id, nextState, null);
      try {
        await recordMatch(room.id, winner, { order: nextState.winnerOrder });
      } catch (e: any) {
        console.error("record match failed", e);
      }
      if (winner === user?.id) sfx.win(); else sfx.lose();
      return;
    }

    if (!result.extraTurn) {
      nextState = nextTurn(nextState);
      nextTurnId = nextState.players[nextState.turnIdx].user_id;
    }
    await updateGameState(room.id, nextState, nextTurnId);
  };

  // Click on canvas — pick token
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!myTurn || state.dice === null || !me) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cell = rect.width / 15;
    const allowed = new Set(legalMoves(state, state.dice));
    me.tokens.forEach((pos, i) => {
      if (!allowed.has(i)) return;
      const [tx, ty] = tokenScreenPos(me.color, pos, i);
      const dx = x - (tx + 0.5) * cell;
      const dy = y - (ty + 0.5) * cell;
      if (Math.hypot(dx, dy) < cell * 0.45) handlePickToken(i);
    });
  };

  const finished = room.status === "finished";
  const winnerProfile = finished ? players.find((p) => p.user_id === room.winner_id) : null;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 max-w-6xl mx-auto">
      <div className="bg-card rounded-3xl shadow-card p-3 md:p-5">
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="w-full aspect-square rounded-2xl cursor-pointer"
        />
      </div>

      <aside className="space-y-4">
        <div className="bg-card rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-google uppercase tracking-wider text-muted-foreground">Turn</span>
            <button onClick={() => setMuted(sfx.toggleMute())} className="text-muted-foreground hover:text-foreground">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          {currentProfile && (
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[currentPlayer.color] }} />
              <Avatar className="h-9 w-9">
                <AvatarImage src={currentProfile.avatar_url ?? undefined} />
                <AvatarFallback className="gradient-primary text-primary-foreground font-semibold">
                  {(currentProfile.display_name || currentProfile.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{currentProfile.display_name || currentProfile.username}</div>
                <div className="text-xs text-muted-foreground">{myTurn ? "Your turn" : "Waiting..."}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-card p-5 text-center">
          <DiceVisual value={state.dice} rolling={diceRolling} />
          <Button
            onClick={handleRoll}
            disabled={!myTurn || state.dice !== null || diceRolling || finished}
            className="w-full mt-4 h-11 rounded-full font-google font-medium shadow-glow"
          >
            {state.dice !== null ? "Pick a token" : "Roll dice"}
          </Button>
          {myTurn && state.dice !== null && (
            <p className="text-xs text-muted-foreground mt-2">Tap a glowing token to move it</p>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-card p-4">
          <h4 className="text-xs font-google uppercase tracking-wider text-muted-foreground mb-3">Players</h4>
          <div className="space-y-2">
            {state.players.map((p, idx) => {
              const prof = players.find((x) => x.user_id === p.user_id);
              const finishedTokens = p.tokens.filter((t) => t === 106).length;
              const active = idx === state.turnIdx;
              return (
                <div key={p.user_id} className={`flex items-center gap-3 p-2 rounded-xl ${active ? "bg-accent" : ""}`}>
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[p.color] }} />
                  <span className="flex-1 text-sm font-medium truncate">{prof?.display_name || prof?.username}</span>
                  <span className="text-xs text-muted-foreground">{finishedTokens}/4 home</span>
                </div>
              );
            })}
          </div>
        </div>

        {finished && (
          <div className="bg-card rounded-2xl shadow-card p-6 text-center animate-fade-in-up">
            <Trophy className="h-10 w-10 text-google-yellow mx-auto mb-2" />
            <div className="font-display text-xl font-bold">{winnerProfile?.user_id === user?.id ? "You won!" : `${winnerProfile?.display_name || winnerProfile?.username} won`}</div>
            <Button onClick={() => navigate("/dashboard")} className="mt-4 rounded-full">Back to dashboard</Button>
          </div>
        )}
      </aside>
    </div>
  );

  // ---- helpers ----
  function tokenScreenPos(color: LudoColor, pos: number, tokenIdx: number): [number, number] {
    if (pos === -1) {
      const [bx, by] = BASE[color];
      const dx = (tokenIdx % 2) * 2;
      const dy = Math.floor(tokenIdx / 2) * 2;
      return [bx + dx, by + dy];
    }
    if (pos === 106) {
      // center
      const [hx, hy] = HOME_COLS[color][4];
      return [hx, hy];
    }
    if (pos >= 100) {
      const idx = pos - 100;
      return HOME_COLS[color][idx];
    }
    const abs = (ENTRY_OFFSET[color] + pos) % 52;
    const [c, r] = MAIN_PATH[abs];
    return [c, r];
  }

  function drawBoard(ctx: CanvasRenderingContext2D, size: number, st: LudoState, dice: number | null) {
    const cell = size / 15;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "hsl(0 0% 100%)";
    ctx.fillRect(0, 0, size, size);

    // Color quadrants (home areas 6x6)
    const quads: [LudoColor, number, number][] = [
      ["red", 0, 0],
      ["blue", 9, 0],
      ["green", 9, 9],
      ["yellow", 0, 9],
    ];
    quads.forEach(([color, qx, qy]) => {
      ctx.fillStyle = COLOR_SOFT[color];
      ctx.fillRect(qx * cell, qy * cell, 6 * cell, 6 * cell);
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.lineWidth = 2;
      ctx.strokeRect(qx * cell + 4, qy * cell + 4, 6 * cell - 8, 6 * cell - 8);
      // base circle
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc((qx + 3) * cell, (qy + 3) * cell, cell * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Center triangle
    ctx.save();
    const cx = 7.5 * cell, cy = 7.5 * cell;
    const triPts: [LudoColor, [number, number][]][] = [
      ["red", [[6 * cell, 6 * cell], [9 * cell, 6 * cell], [cx, cy]]],
      ["blue", [[9 * cell, 6 * cell], [9 * cell, 9 * cell], [cx, cy]]],
      ["green", [[9 * cell, 9 * cell], [6 * cell, 9 * cell], [cx, cy]]],
      ["yellow", [[6 * cell, 9 * cell], [6 * cell, 6 * cell], [cx, cy]]],
    ];
    triPts.forEach(([color, pts]) => {
      ctx.fillStyle = COLOR_HEX[color];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // Path cells
    MAIN_PATH.forEach(([c, r], i) => {
      ctx.fillStyle = "white";
      ctx.fillRect(c * cell, r * cell, cell, cell);
      ctx.strokeStyle = "hsl(215 28% 88%)";
      ctx.lineWidth = 1;
      ctx.strokeRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      if (SAFE_CELLS.has(i)) {
        ctx.fillStyle = "hsl(215 32% 92%)";
        ctx.fillRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8);
        // star
        ctx.fillStyle = "hsl(215 16% 60%)";
        drawStar(ctx, (c + 0.5) * cell, (r + 0.5) * cell, cell * 0.18, cell * 0.08, 5);
      }
    });
    // colored entry cells
    (["red", "blue", "green", "yellow"] as LudoColor[]).forEach((color) => {
      const i = ENTRY_OFFSET[color];
      const [c, r] = MAIN_PATH[i];
      ctx.fillStyle = COLOR_SOFT[color];
      ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      ctx.strokeStyle = COLOR_HEX[color];
      ctx.strokeRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
    });
    // home columns
    (Object.keys(HOME_COLS) as LudoColor[]).forEach((color) => {
      HOME_COLS[color].forEach(([c, r]) => {
        ctx.fillStyle = COLOR_HEX[color];
        ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
      });
    });

    // Highlight legal tokens
    const legalSet = (myTurn && dice !== null && me) ? new Set(legalMoves(st, dice)) : new Set<number>();

    // Draw tokens
    st.players.forEach((p) => {
      p.tokens.forEach((pos, i) => {
        const [tx, ty] = tokenScreenPos(p.color, pos, i);
        const x = (tx + 0.5) * cell;
        const y = (ty + 0.5) * cell;
        const radius = cell * 0.32;
        const isMine = p.user_id === user?.id;
        const isLegal = isMine && legalSet.has(i);

        if (isLegal) {
          ctx.save();
          ctx.shadowColor = COLOR_HEX[p.color];
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
          ctx.fillStyle = "white";
          ctx.fill();
          ctx.restore();
        }

        // outer
        ctx.fillStyle = COLOR_HEX[p.color];
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        // gloss
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // border
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
    });
  }
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function DiceVisual({ value, rolling }: { value: number | null; rolling: boolean }) {
  const [display, setDisplay] = useState<number>(value ?? 1);
  useEffect(() => {
    if (rolling) {
      const id = setInterval(() => setDisplay(1 + Math.floor(Math.random() * 6)), 80);
      return () => clearInterval(id);
    } else if (value !== null) {
      setDisplay(value);
    }
  }, [rolling, value]);

  const dotPositions: Record<number, [number, number][]> = {
    1: [[1,1]],
    2: [[0,0],[2,2]],
    3: [[0,0],[1,1],[2,2]],
    4: [[0,0],[2,0],[0,2],[2,2]],
    5: [[0,0],[2,0],[1,1],[0,2],[2,2]],
    6: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]],
  };
  const dots = dotPositions[display] ?? [];

  return (
    <div className={`mx-auto h-20 w-20 rounded-2xl bg-white shadow-elev grid grid-cols-3 grid-rows-3 gap-1 p-2.5 ${rolling ? "animate-pulse" : ""}`}>
      {[0,1,2,3,4,5,6,7,8].map((i) => {
        const c = i % 3, r = Math.floor(i / 3);
        const on = dots.some(([dc, dr]) => dc === c && dr === r);
        return <div key={i} className={`rounded-full ${on ? "bg-foreground" : "bg-transparent"}`} />;
      })}
    </div>
  );
}
