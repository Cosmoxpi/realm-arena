
CREATE TYPE public.room_status AS ENUM ('waiting', 'playing', 'finished', 'abandoned');

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  game_type game_type NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_ids UUID[] NOT NULL DEFAULT '{}',
  max_players INTEGER NOT NULL DEFAULT 2,
  status room_status NOT NULL DEFAULT 'waiting',
  game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_turn UUID,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_rooms_code ON public.rooms(code);
CREATE INDEX idx_rooms_player_ids ON public.rooms USING GIN(player_ids);
CREATE INDEX idx_rooms_status ON public.rooms(status);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

CREATE POLICY "Players can view rooms they are in"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(player_ids) OR auth.uid() = host_id);

CREATE POLICY "Authenticated users can create rooms"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id AND auth.uid() = ANY(player_ids));

CREATE POLICY "Players in room can update room"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(player_ids));

CREATE POLICY "Host can delete room"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate a unique 6-char room code
CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = result AND status IN ('waiting', 'playing'));
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique code';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- Join a waiting room by code
CREATE OR REPLACE FUNCTION public.join_room_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room rooms;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _room FROM public.rooms WHERE code = upper(_code) AND status = 'waiting' FOR UPDATE;

  IF _room.id IS NULL THEN
    RAISE EXCEPTION 'Room not found or already started';
  END IF;

  IF _uid = ANY(_room.player_ids) THEN
    RETURN _room.id;
  END IF;

  IF array_length(_room.player_ids, 1) >= _room.max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  UPDATE public.rooms
  SET player_ids = array_append(player_ids, _uid)
  WHERE id = _room.id;

  RETURN _room.id;
END;
$$;

-- Atomically record match result and update player stats
CREATE OR REPLACE FUNCTION public.record_match_result(
  _room_id UUID,
  _winner_id UUID,
  _score JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room rooms;
  _match_id UUID;
  _player UUID;
  _duration INT;
BEGIN
  SELECT * INTO _room FROM public.rooms WHERE id = _room_id;
  IF _room.id IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF auth.uid() <> ALL(_room.player_ids) THEN
    -- only allow players in the room to record
    IF NOT (auth.uid() = ANY(_room.player_ids)) THEN
      RAISE EXCEPTION 'Not a player';
    END IF;
  END IF;

  IF _room.status = 'finished' THEN
    RETURN NULL;
  END IF;

  _duration := EXTRACT(EPOCH FROM (now() - COALESCE(_room.started_at, _room.created_at)))::int;

  INSERT INTO public.match_history (game_type, player_ids, winner_id, score, duration_seconds)
  VALUES (_room.game_type, _room.player_ids, _winner_id, _score, _duration)
  RETURNING id INTO _match_id;

  UPDATE public.rooms
  SET status = 'finished', winner_id = _winner_id, finished_at = now()
  WHERE id = _room_id;

  -- Update stats: winner gets +1 win + rating, others +1 loss - rating
  FOREACH _player IN ARRAY _room.player_ids LOOP
    IF _player = _winner_id THEN
      UPDATE public.profiles
      SET games_played = games_played + 1,
          wins = wins + 1,
          rating = rating + 20
      WHERE user_id = _player;
    ELSE
      UPDATE public.profiles
      SET games_played = games_played + 1,
          losses = losses + 1,
          rating = GREATEST(0, rating - 10)
      WHERE user_id = _player;
    END IF;
  END LOOP;

  RETURN _match_id;
END;
$$;

-- Helper to fetch profile snippets by user_ids (avoids N+1 queries)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(_ids UUID[])
RETURNS TABLE(user_id UUID, username TEXT, display_name TEXT, avatar_url TEXT, rating INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, username, display_name, avatar_url, rating
  FROM public.profiles
  WHERE user_id = ANY(_ids);
$$;
