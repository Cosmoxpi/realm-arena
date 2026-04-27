import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useRoom, startGame } from "@/hooks/useRoom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const { roomId } = useParams<{ gameType: "cricket" | "ludo"; roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { room, players, loading, error } = useRoom(roomId);

  // 🔥 REALTIME
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel("room-" + roomId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {}
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="text-center mt-20">
          <h1>Room not found</h1>
          <Button onClick={() => navigate("/dashboard")}>Go Back</Button>
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user?.id;

  const copy = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Copied");
  };

  // 🚀 START GAME (FIXED)
  const handleStart = async () => {
    const playerIds = players.map((p) => p.user_id);

    const initial =
      room.game_type === "ludo"
        ? initLudoState(playerIds)
        : initCricketState(playerIds, 3); // ✅ removed settings

    await startGame(room.id, initial, playerIds[0]);
  };

  // 🚀 LEAVE ROOM
  const leaveRoom = async () => {
    if (!user) return;

    await supabase
      .from("players")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    navigate("/dashboard");
  };

  // 🎮 LOBBY
  if (room.status === "waiting") {
    return (
      <div className="min-h-screen">
        <Navbar />

        <div className="max-w-xl mx-auto mt-10">

          <button onClick={leaveRoom}>
            <ArrowLeft /> Leave
          </button>

          <h1 className="text-3xl text-center">{room.code}</h1>

          <Button onClick={copy}>Copy Code</Button>

          {/* PLAYERS */}
          <div className="mt-6">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border p-2 mb-2">

                <Avatar>
                  <AvatarFallback>
                    {p.user_id.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <span>{p.user_id}</span>

                {p.user_id === room.host_id && <Crown />}
              </div>
            ))}
          </div>

          {/* START */}
          {isHost && (
            <Button
              onClick={handleStart}
              disabled={players.length < 2}
            >
              <Play /> Start Game
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 🎮 GAME SCREEN
  return (
    <div className="min-h-screen">
      <Navbar />

      {room.game_type === "ludo" ? (
        <LudoBoard room={room} players={players} />
      ) : (
        <CricketGame room={room} players={players} />
      )}
    </div>
  );
}