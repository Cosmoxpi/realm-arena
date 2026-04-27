-- ROOMS TABLE
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null,
  game_type text not null,
  match_type text,
  max_players integer default 4,
  status text default 'waiting',
  game_state jsonb,
  current_turn uuid,
  created_at timestamp default now()
);

-- PLAYERS TABLE
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid not null,
  created_at timestamp default now(),
  unique(room_id, user_id)
);

-- FUNCTION
create or replace function generate_room_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random()*length(chars)+1)::int, 1);
  end loop;
  return result;
end;
$$;

-- DEFAULT
alter table public.rooms
alter column code set default generate_room_code();