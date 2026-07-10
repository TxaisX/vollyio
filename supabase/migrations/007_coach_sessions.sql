-- Coach chat sessions: conversations become discrete, navigable threads
-- instead of one endless transcript.

create table if not exists coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  title text not null default 'New session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coach_sessions_user_recent
  on coach_sessions (user_id, updated_at desc);
alter table coach_sessions enable row level security;
drop policy if exists "own coach sessions" on coach_sessions;
create policy "own coach sessions" on coach_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table chat_messages
  add column if not exists session_id uuid references coach_sessions on delete cascade;
create index if not exists chat_messages_session_recent
  on chat_messages (session_id, created_at);

-- Backfill: existing messages become one legacy session per user.
insert into coach_sessions (user_id, title, created_at, updated_at)
select user_id, 'Earlier conversations', min(created_at), max(created_at)
from chat_messages
where session_id is null
group by user_id;

update chat_messages m
set session_id = s.id
from coach_sessions s
where m.session_id is null
  and s.user_id = m.user_id
  and s.title = 'Earlier conversations';
