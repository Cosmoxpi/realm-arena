import { useEffect, useMemo, useRef, useState } from "react";
import { Room, PlayerProfile, updateGameState, recordMatch } from "@/hooks/useRoom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { sfx } from "@/lib/sfx";
import { Trophy, Volume2, VolumeX, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  applyBall, BallLine, BallSpeed, CricketBall, CricketState,
  currentBatterBowler, initCricketState, inningsScoreText, resolveBall,
  setToss, ShotType, totalLegalBalls
} from "./logic";

export function CricketGame({ room, players }: { room: Room; players: PlayerProfile[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(sfx.isMuted());
  const [tossChoice, setTossChoice] = useState<"heads" | "tails" | null>(null);

  const state: CricketState = (room.game_state && (room.game_state as any).version === 1)
    ? (room.game_state as CricketState)
    : initCricketState(room.player_ids, room.settings?.overs ?? 3);

  const me = user?.id;
  const profileById = useMemo(() => Object.fromEntries(players.map((p) => [p.user_id, p])), [players]);

  // Record match once when finished (host only). Lifted above any early return so hooks order is stable.
  const finishedAndHost = !!state.result && room.host_id === me && room.status !== "finished" && !!state.result?.winnerId;
  useEffect(() => {
    if (!finishedAndHost) return;
    const score = {
      innings1: { runs: state.innings1?.runs, wickets: state.innings1?.wickets },
      innings2: { runs: state.innings2?.runs, wickets: state.innings2?.wickets },
      margin: state.result?.margin,
    };
    recordMatch(room.id, state.result!.winnerId!, score).catch(console.error);
    if (state.result!.winnerId === me) sfx.win(); else sfx.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedAndHost]);


  // ---- TOSS ----
  if (!state.toss && room.status === "playing") {
    const isHost = room.host_id === me;
    const handleToss = async (choice: "heads" | "tails") => {
      if (!isHost) return;
      sfx.click();
      setTossChoice(choice);
      const result = Math.random() < 0.5 ? "heads" : "tails";
      const winnerId = result === choice ? room.host_id : room.player_ids.find((id) => id !== room.host_id)!;
      // Winner auto-chooses to bat (could be expanded with another step)
      await new Promise((r) => setTimeout(r, 700));
      const newState = setToss(state, winnerId, "bat");
      await updateGameState(room.id, newState, newState.innings1!.bowlingId);
    };

    return (
      <div className="max-w-md mx-auto bg-card rounded-3xl shadow-card p-8 text-center animate-fade-in-up">
        <h2 className="font-display text-2xl font-bold mb-1">Toss time</h2>
        <p className="text-muted-foreground text-sm mb-6">Host calls heads or tails.</p>
        {isHost ? (
          <div className="flex gap-3 justify-center">
            <Button onClick={() => handleToss("heads")} disabled={!!tossChoice} className="rounded-full px-8 h-12">Heads</Button>
            <Button onClick={() => handleToss("tails")} disabled={!!tossChoice} className="rounded-full px-8 h-12" variant="outline">Tails</Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Waiting for host…</p>
        )}
      </div>
    );
  }

  if (!state.toss || !state.innings1) {
    return <div className="text-center py-10 text-muted-foreground">Setting up...</div>;
  }

  const innings = state.innings === 1 ? state.innings1! : state.innings2!;
  const { battingId, bowlingId } = innings;
  const isBatter = me === battingId;
  const isBowler = me === bowlingId;
  const finished = !!state.result;

  // Game over screen
  if (finished) {
    const winnerProfile = state.result!.winnerId ? profileById[state.result!.winnerId] : null;
    return (
      <div className="max-w-md mx-auto bg-card rounded-3xl shadow-card p-8 text-center animate-fade-in-up">
        <Trophy className="h-12 w-12 text-google-yellow mx-auto mb-2" />
        <h2 className="font-display text-3xl font-bold">{winnerProfile?.user_id === me ? "You won! 🏆" : `${winnerProfile?.display_name || winnerProfile?.username} won`}</h2>
        <p className="text-muted-foreground mt-1">{state.result!.margin}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          <Scorecard label="Innings 1" innings={state.innings1!} batterName={profileById[state.innings1!.battingId]?.username} overs={state.overs} />
          <Scorecard label="Innings 2" innings={state.innings2!} batterName={profileById[state.innings2!.battingId]?.username} overs={state.overs} />
        </div>
        <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-full">Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 max-w-6xl mx-auto">
      {/* Stadium / playfield */}
      <div className="bg-card rounded-3xl shadow-card overflow-hidden">
        <Stadium state={state} lastBall={state.lastBall} />
        <div className="p-5">
          <Controls
            state={state}
            isBatter={isBatter}
            isBowler={isBowler}
            onBowl={async (speed, line) => {
              sfx.click();
              const next: CricketState = { ...state, pendingBowl: { speed, line }, awaitingBatter: true };
              await updateGameState(room.id, next, battingId);
            }}
            onShot={async (shot, timing) => {
              if (!state.pendingBowl) return;
              const ball: CricketBall = { ...state.pendingBowl, shot, timing };
              const result = resolveBall(ball);
              if (result.wicket) sfx.wicket();
              else if (result.runs === 6) sfx.six();
              else if (result.runs === 4) sfx.four();
              else if (result.runs > 0) sfx.move();
              else sfx.hit();

              const next = applyBall(state, ball, result);
              const nextTurnId = next.result ? null
                : next.pendingBowl === null && !next.awaitingBatter
                  ? (next.innings === 1 ? next.innings1!.bowlingId : next.innings2!.bowlingId)
                  : battingId;
              await updateGameState(room.id, next, nextTurnId);
            }}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-4">
        <div className="bg-card rounded-2xl shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-google uppercase tracking-wider text-muted-foreground">Live score</span>
            <button onClick={() => setMuted(sfx.toggleMute())} className="text-muted-foreground hover:text-foreground">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <div className="space-y-3">
            <PlayerLine
              label={state.innings === 1 ? "Batting" : "1st innings"}
              profile={profileById[state.innings1!.battingId]}
              text={inningsScoreText(state.innings1, state.overs)}
              active={state.innings === 1}
            />
            {state.innings2 && (
              <PlayerLine
                label="2nd innings"
                profile={profileById[state.innings2!.battingId]}
                text={inningsScoreText(state.innings2, state.overs)}
                active={state.innings === 2}
              />
            )}
          </div>
          {state.innings === 2 && state.innings1 && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              Target: <span className="font-semibold text-foreground">{state.innings1.runs + 1}</span>
              {" · "}
              Need <span className="font-semibold text-foreground">{Math.max(0, state.innings1.runs + 1 - state.innings2!.runs)}</span> from{" "}
              <span className="font-semibold text-foreground">{totalLegalBalls(state.overs) - state.innings2!.ballsBowled}</span> balls
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-card p-4">
          <h4 className="text-xs font-google uppercase tracking-wider text-muted-foreground mb-3">Recent balls</h4>
          <div className="flex flex-wrap gap-1.5">
            {innings.balls.slice(-12).map((b, i) => {
              const r = b.result;
              if (!r) return null;
              const cls = r.wicket ? "bg-destructive text-destructive-foreground"
                : r.runs === 6 ? "bg-google-yellow text-foreground"
                : r.runs === 4 ? "bg-success text-success-foreground"
                : r.runs > 0 ? "bg-accent text-accent-foreground"
                : "bg-secondary text-secondary-foreground";
              const text = r.wicket ? "W" : r.runs;
              return <span key={i} className={`h-7 w-7 rounded-full text-xs font-bold flex items-center justify-center ${cls}`}>{text}</span>;
            })}
            {innings.balls.length === 0 && <span className="text-xs text-muted-foreground">No balls yet</span>}
          </div>
        </div>

        {state.lastBall && (
          <div className="bg-card rounded-2xl shadow-card p-4 animate-fade-in-up">
            <h4 className="text-xs font-google uppercase tracking-wider text-muted-foreground mb-2">Commentary</h4>
            <p className="text-sm font-medium">{state.lastBall.description}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function PlayerLine({ label, profile, text, active }: { label: string; profile?: PlayerProfile; text: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl ${active ? "bg-accent" : ""}`}>
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile?.avatar_url ?? undefined} />
        <AvatarFallback className="gradient-primary text-primary-foreground font-semibold text-xs">
          {(profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-medium truncate text-sm">{profile?.display_name || profile?.username}</div>
      </div>
      <div className="font-display font-bold tabular-nums">{text}</div>
    </div>
  );
}

function Scorecard({ label, innings, batterName, overs }: { label: string; innings: any; batterName?: string; overs: number }) {
  return (
    <div className="bg-surface rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium text-sm truncate">{batterName ?? "—"}</div>
      <div className="font-display text-lg font-bold">{inningsScoreText(innings, overs)}</div>
    </div>
  );
}

// ---- Stadium SVG ----
function Stadium({ state, lastBall }: { state: CricketState; lastBall?: CricketState["lastBall"] }) {
  const innings = state.innings === 1 ? state.innings1! : state.innings2!;
  const out = innings.balls[innings.balls.length - 1]?.result;
  return (
    <div className="relative gradient-cricket aspect-[16/9] overflow-hidden">
      {/* stands ring */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 50% 60%, transparent 30%, rgba(255,255,255,0.4) 70%)" }} />
      {/* field */}
      <svg viewBox="0 0 400 225" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="grass" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="hsl(137 60% 55%)" />
            <stop offset="100%" stopColor="hsl(137 55% 38%)" />
          </radialGradient>
          <linearGradient id="pitch" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(35 50% 78%)" />
            <stop offset="100%" stopColor="hsl(30 45% 68%)" />
          </linearGradient>
        </defs>
        <ellipse cx="200" cy="135" rx="180" ry="100" fill="url(#grass)" />
        <ellipse cx="200" cy="135" rx="180" ry="100" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <ellipse cx="200" cy="135" rx="80" ry="42" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 3" />
        {/* pitch */}
        <rect x="186" y="100" width="28" height="74" rx="2" fill="url(#pitch)" />
        <rect x="186" y="100" width="28" height="74" rx="2" fill="none" stroke="rgba(255,255,255,0.6)" />
        {/* stumps */}
        <line x1="194" y1="105" x2="194" y2="113" stroke="white" strokeWidth="1.5" />
        <line x1="200" y1="104" x2="200" y2="113" stroke="white" strokeWidth="1.5" />
        <line x1="206" y1="105" x2="206" y2="113" stroke="white" strokeWidth="1.5" />
        <line x1="194" y1="161" x2="194" y2="169" stroke="white" strokeWidth="1.5" />
        <line x1="200" y1="160" x2="200" y2="169" stroke="white" strokeWidth="1.5" />
        <line x1="206" y1="161" x2="206" y2="169" stroke="white" strokeWidth="1.5" />
        {/* Batter / bowler */}
        <circle cx="200" cy="170" r="5" fill="hsl(217 89% 51%)" stroke="white" strokeWidth="1.5" />
        <circle cx="200" cy="105" r="5" fill="hsl(4 90% 58%)" stroke="white" strokeWidth="1.5" />
        {/* Ball animation */}
        {out && !out.wicket && out.runs > 0 && (
          <circle cx="200" cy="170" r="3" fill="white">
            <animate attributeName="cx" from="200" to={out.runs >= 4 ? (out.runs === 6 ? "350" : "320") : "240"} dur="0.9s" fill="freeze" />
            <animate attributeName="cy" from="170" to={out.runs === 6 ? "30" : out.runs === 4 ? "100" : "150"} dur="0.9s" fill="freeze" />
          </circle>
        )}
      </svg>
      {/* HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-white">
        <div className="text-xs font-google uppercase tracking-wider opacity-90">Innings {state.innings}</div>
        <div className="font-display font-bold tabular-nums text-lg">{inningsScoreText(innings, state.overs)}</div>
      </div>
      {state.lastBall && (
        <div className="absolute bottom-3 left-4 right-4 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-foreground text-sm font-semibold">
            {state.lastBall.description}
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Controls ----
function Controls({
  state, isBatter, isBowler, onBowl, onShot,
}: {
  state: CricketState;
  isBatter: boolean;
  isBowler: boolean;
  onBowl: (speed: BallSpeed, line: BallLine) => void;
  onShot: (shot: ShotType, timing: number) => void;
}) {
  const [speed, setSpeed] = useState<BallSpeed>("medium");
  const [line, setLine] = useState<BallLine>("middle");
  const [shot, setShot] = useState<ShotType>("drive");
  const [timing, setTiming] = useState<number | null>(null);
  const [meterRunning, setMeterRunning] = useState(false);
  const [meterValue, setMeterValue] = useState(0);
  const animRef = useRef<number | null>(null);

  // Timing meter sweeps 0->100->0; tap to lock value
  useEffect(() => {
    if (!meterRunning) return;
    let dir = 1;
    let v = 0;
    const tick = () => {
      v += dir * 3.5;
      if (v >= 100) { v = 100; dir = -1; }
      if (v <= 0) { v = 0; dir = 1; }
      setMeterValue(v);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [meterRunning]);

  const startBatting = () => {
    if (!isBatter || !state.pendingBowl) return;
    setMeterRunning(true);
    setMeterValue(0);
  };
  const lockTiming = () => {
    if (!meterRunning) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setMeterRunning(false);
    const v = Math.round(meterValue);
    setTiming(v);
    onShot(shot, v);
    setTimeout(() => { setTiming(null); }, 1500);
  };

  if (state.awaitingBatter) {
    return (
      <div className="space-y-4">
        {isBatter ? (
          <>
            <div>
              <Label2>Shot type</Label2>
              <PillRow value={shot} onChange={setShot} options={[
                { v: "defend", label: "Defend" },
                { v: "drive", label: "Drive" },
                { v: "pull", label: "Pull" },
                { v: "loft", label: "Loft" },
              ]} />
            </div>
            <div>
              <Label2>Timing — tap to lock</Label2>
              <div className="relative h-12 rounded-full bg-secondary overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1/3 bg-gradient-to-r from-success/30 via-success to-success/30" />
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-foreground rounded-full transition-none"
                  style={{ left: `${meterValue}%`, transform: "translateX(-50%)" }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-google font-medium pointer-events-none">
                  {timing !== null ? `Timing: ${timing}` : meterRunning ? "Tap when in the green" : "Press start"}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {!meterRunning ? (
                  <Button onClick={startBatting} className="flex-1 h-11 rounded-full font-google font-medium shadow-glow">
                    <Zap className="h-4 w-4 mr-1" /> Start swing
                  </Button>
                ) : (
                  <Button onClick={lockTiming} className="flex-1 h-11 rounded-full font-google font-medium shadow-glow">
                    Hit!
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-6">Bowled a {state.pendingBowl?.speed} on {state.pendingBowl?.line} stump — waiting for batter…</p>
        )}
      </div>
    );
  }

  // Bowler input
  return (
    <div className="space-y-4">
      {isBowler ? (
        <>
          <div>
            <Label2>Speed</Label2>
            <PillRow value={speed} onChange={setSpeed} options={[
              { v: "slow", label: "Slow" },
              { v: "medium", label: "Medium" },
              { v: "fast", label: "Fast" },
            ]} />
          </div>
          <div>
            <Label2>Line</Label2>
            <PillRow value={line} onChange={setLine} options={[
              { v: "off", label: "Off stump" },
              { v: "middle", label: "Middle" },
              { v: "leg", label: "Leg stump" },
            ]} />
          </div>
          <Button onClick={() => onBowl(speed, line)} className="w-full h-11 rounded-full font-google font-medium shadow-glow">
            Bowl
          </Button>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-6">Waiting for bowler…</p>
      )}
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-google uppercase tracking-wider text-muted-foreground mb-2">{children}</div>;
}

function PillRow<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: any) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-4 h-10 rounded-full text-sm font-medium transition-smooth ${
            value === o.v ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-secondary-foreground hover:bg-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
