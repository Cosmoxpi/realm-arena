import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface Room {
  id: string;
  code: string;
  game_type: "cricket" | "ludo";
  host_id: string;
  player_ids: string[];
  max_players: number;
  status: "waiting" | "playing" | "finished" | "abandoned";
  game_state: any;
  current_turn: string | null;
  winner_id: string | null;
  settings: any;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface PlayerProfile {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating: number;
}

export async function createRoom(
  game_type: "cricket" | "ludo",
  max_players: number,
  settings: any = {}
): Promise<Room> {
  const { data: codeData, error: codeErr } = await supabase.rpc("generate_room_code");
  if (codeErr) throw codeErr;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      code: codeData as string,
      game_type,
      host_id: user.id,
      player_ids: [user.id],
      max_players,
      settings,
      current_turn: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Room;
}

export async function joinRoomByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_room_by_code", { _code: code.toUpperCase() });
  if (error) throw error;
  return data as string;
}

export async function startGame(roomId: string, initialState: any, firstTurnId: string) {
  const { error } = await supabase
    .from("rooms")
    .update({
      status: "playing",
      game_state: initialState,
      current_turn: firstTurnId,
      started_at: new Date().toISOString(),
    })
    .eq("id", roomId);
  if (error) throw error;
}

export async function updateGameState(roomId: string, game_state: any, current_turn: string | null) {
  const { error } = await supabase
    .from("rooms")
    .update({ game_state, current_turn })
    .eq("id", roomId);
  if (error) throw error;
}

export async function recordMatch(roomId: string, winnerId: string, score: any) {
  const { error } = await supabase.rpc("record_match_result", {
    _room_id: roomId,
    _winner_id: winnerId,
    _score: score,
  });
  if (error) throw error;
}

export function useRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (error) { setError(error.message); return; }
    if (!data) { setError("Room not found"); return; }
    setRoom(data as Room);
    if (data.player_ids?.length) {
      const { data: profs } = await supabase.rpc("get_profiles_by_ids", { _ids: data.player_ids });
      setPlayers((profs ?? []) as PlayerProfile[]);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    fetchRoom();
    const channel: RealtimeChannel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setRoom(null);
            return;
          }
          const next = payload.new as Room;
          setRoom(next);
          // refresh players if list changed
          setPlayers((prev) => {
            const ids = new Set(prev.map((p) => p.user_id));
            const changed = next.player_ids.length !== prev.length || next.player_ids.some((id) => !ids.has(id));
            if (changed) fetchRoom();
            return prev;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, fetchRoom]);

  return { room, players, loading, error, refresh: fetchRoom };
}
