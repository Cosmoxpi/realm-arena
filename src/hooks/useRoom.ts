import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

/* =========================
   🔄 ROOM HOOK
========================= */
export const useRoom = (roomId?: string) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError) {
      setError(roomError.message);
      setLoading(false);
      return;
    }

    setRoom(roomData);

    const { data: playersData } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId);

    setPlayers(playersData || []);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  return { room, players, loading, error };
};

/* =========================
   🚀 CREATE ROOM
========================= */
export const createRoom = async (
  userId: string,
  gameType: string,
  matchType: string
) => {
  const { data: code, error: codeError } = await supabase.rpc(
    "generate_room_code"
  );

  if (codeError) throw codeError;

  const { data, error } = await supabase
    .from("rooms")
    .insert(
      {
        room_code: code,          // ✅ matches DB
        host_id: userId,          // ✅ UUID
        match_type: gameType,     // ✅ "cricket" / "ludo"
        max_players: 4,
      } as never
    )
    .select()
    .single();

  if (error || !data) throw error;

  const room = data as Room;

  await supabase.from("players").insert(
    {
      room_id: room.id,
      user_id: userId,
    } as never
  );

  return room;
};

/* =========================
   🚀 JOIN ROOM
========================= */
export const joinRoom = async (code: string, userId: string) => {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code) // ✅ correct column
    .single();

  if (error || !data) throw error;

  const room = data as Room;

  await supabase.from("players").insert(
    {
      room_id: room.id,
      user_id: userId,
    } as never
  );

  return room.id;
};

/* =========================
   🔁 ALIAS (PlayDialog FIX)
========================= */
export const joinRoomByCode = joinRoom;

/* =========================
   🎮 START GAME
========================= */
export const startGame = async (
  roomId: string,
  state: unknown,
  firstTurn: string
) => {
  const { error } = await supabase
    .from("rooms")
    .update(
      {
        status: "playing",
        game_state: state,
        current_turn: firstTurn,
      } as never
    )
    .eq("id", roomId);

  if (error) throw error;
};

/* =========================
   🔄 UPDATE GAME STATE
========================= */
export const updateGameState = async (
  roomId: string,
  state: unknown
) => {
  const { error } = await supabase
    .from("rooms")
    .update(
      {
        game_state: state,
      } as never
    )
    .eq("id", roomId);

  if (error) throw error;
};

/* =========================
   🏆 RECORD MATCH
========================= */
export const recordMatch = async (
  roomId: string,
  winnerId: string,
  gameData: unknown
) => {
  const { error } = await supabase
    .from("match_history")
    .insert(
      {
        room_id: roomId,
        winner_id: winnerId,
        game_data: gameData,
      } as never
    );

  if (error) throw error;
};