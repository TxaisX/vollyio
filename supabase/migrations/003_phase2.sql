-- Phase 2 tables. Written ahead of time; apply when chat/XP/scoreboard/goals ship.

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  skill skill,
  title text not null,
  target_rating int,
  deadline date,
  status text not null default 'active' check (status in ('active','done','abandoned')),
  created_at timestamptz not null default now()
);
alter table goals enable row level security;
create policy "own goals" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  team_a text not null default 'Us',
  team_b text not null default 'Them',
  best_of int not null default 3,
  sets jsonb not null default '[]',
  winner text check (winner in ('a','b')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s int
);
alter table games enable row level security;
create policy "own games" on games
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_recent on chat_messages (user_id, created_at desc);
alter table chat_messages enable row level security;
create policy "own chat" on chat_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table xp_events enable row level security;
create policy "own xp" on xp_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
