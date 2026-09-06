create table public.todo_rooms (
  room_code text primary key check (char_length(room_code) between 3 and 24),
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.todo_rooms enable row level security;

create policy "Anyone with a room code can use that room"
on public.todo_rooms
for all
to anon, authenticated
using (true)
with check (true);

alter publication supabase_realtime add table public.todo_rooms;
