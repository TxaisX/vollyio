create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  skill skill not null,
  source text not null check (source in ('video','photos')),
  duration_s numeric,
  frame_count int not null,
  frame_paths text[] not null default '{}',
  thumb_path text,
  overall_score int not null check (overall_score between 0 and 100),
  result jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index analyses_user_recent on analyses (user_id, created_at desc);
create index analyses_user_skill on analyses (user_id, skill, created_at desc);

alter table analyses enable row level security;
create policy "own analyses" on analyses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table skill_ratings (
  user_id uuid not null references profiles on delete cascade,
  skill skill not null,
  rating numeric not null,
  analyses_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

alter table skill_ratings enable row level security;
create policy "own ratings" on skill_ratings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('frames', 'frames', false);

create policy "own frame objects select" on storage.objects
  for select using (
    bucket_id = 'frames' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own frame objects insert" on storage.objects
  for insert with check (
    bucket_id = 'frames' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own frame objects delete" on storage.objects
  for delete using (
    bucket_id = 'frames' and (storage.foldername(name))[1] = auth.uid()::text
  );
