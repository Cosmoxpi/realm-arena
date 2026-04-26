import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useRoom, startGame } from "@/hooks/useRoom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Copy, Crown, Play, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { sfx } from "@/lib/sfx";
import { LudoBoard } from "@/games/ludo/LudoBoard";
import { CricketGame } from "@/games/cricket/CricketGame";
import { initLudoState } from "@/games/ludo/logic";
import { initCricketState } from "@/games/cricket/logic";
import { supabase } from "@/integrations/supabase/client";

export default function GameRoom() {
  const { gameType, roomId } = useParams<{ gameType: "cricket" | "ludo"; roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, players, loading, error } = useRoom(roomId);

  useEffect(() => {
    // navigate away if room finishes? we keep them on the result screen of the game
  }, [room]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error || !room) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center">
          <h1 className="font-display text-2xl font-bold">Room unavailable</h1>
          <p className="text-muted-foreground mt-2">{error ?? "This room doesn't exist or has ended."}</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-full">Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user?.id;
  const inviteUrl = `${window.location.origin}/play/${room.game_type}/${room.id}`;

  const copy = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Room code copied");
    sfx.click();
  };
  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
    sfx.click();
  };

  const handleStart = async () => {
    if (!room) return;
    const initial = room.game_type === "ludo"
      ? initLudoState(room.player_ids)
      : initCricketState(room.player_ids, room.settings?.overs ?? 3);
    const firstTurn = room.player_ids[0];
    await startGame(room.id, initial, firstTurn);
    sfx.click();
  };

  const leaveRoom = async () => {
    if (!user) return;
    if (room.status === "waiting") {
      const remaining = room.player_ids.filter((id) => id !== user.id);
      if (remaining.length === 0 || isHost) {
        await supabase.from("rooms").delete().eq("id", room.id);
      } else {
        await supabase.from("rooms").update({ player_ids: remaining }).eq("id", room.id);
      }
    }
    navigate("/dashboard");
  };

  // Lobby
  if (room.status === "waiting") {
    const slots = Array.from({ length: room.max_players }, (_, i) => players[i] ?? null);
    const canStart = isHost && room.player_ids.length >= 2;

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-10 max-w-2xl">
          <button onClick={leaveRoom} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="h-4 w-4" /> Leave
          </button>

          <div className="bg-card rounded-3xl shadow-card p-8 text-center mb-6 animate-fade-in-up">
            <p className="text-xs font-google font-medium text-muted-foreground uppercase tracking-widest">Room code</p>
            <button onClick={copy} className="mt-2 inline-flex items-center gap-3 group">
              <span className="font-display text-5xl md:text-6xl font-bold tracking-[0.2em] text-gradient">{room.code}</span>
              <Copy className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-smooth" />
            </button>
            <p className="text-sm text-muted-foreground mt-3 capitalize">{room.game_type} · {room.max_players} players{room.game_type === "cricket" && room.settings?.overs ? ` · ${room.settings.overs} overs` : ""}</p>
            <Button variant="outline" size="sm" onClick={copyLink} className="mt-4 rounded-full">Copy invite link</Button>
          </div>

          <div className="bg-card rounded-3xl shadow-card p-6 mb-6">
            <h3 className="font-display font-semibold mb-4">Players ({players.length}/{room.max_players})</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(room.max_players, 2)}, 1fr)` }}>
              {slots.map((p, i) => (
                <div key={i} className={`rounded-2xl p-4 border-2 transition-smooth ${p ? "border-primary bg-accent" : "border-dashed border-border"}`}>
                  {p ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="gradient-primary text-primary-foreground font-semibold">
                          {(p.display_name || p.username).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1">
                          {p.display_name || p.username}
                          {p.user_id === room.host_id && <Crown className="h-3.5 w-3.5 text-google-yellow" />}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.rating}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-2 animate-pulse">Waiting for player…</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <Button onClick={handleStart} disabled={!canStart} className="w-full h-12 rounded-full font-google font-medium shadow-glow">
              <Play className="h-4 w-4 mr-1" /> {canStart ? "Start match" : "Waiting for players..."}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Waiting for host to start…</p>
          )}
        </main>
      </div>
    );
  }

  // Active or finished game
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-6">
        {room.game_type === "ludo"
          ? <LudoBoard room={room} players={players} />
          : <CricketGame room={room} players={players} />
        }
      </main>
    </div>
  );
}
