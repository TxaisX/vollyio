-- Flywheel signal (2026-07-23): the player's DECISION on each breakdown -- did the
-- opus-low COACHING nail it. The skill/environment/subject are user-declared at
-- upload, so the model isn't classifying the skill; its job is the technique read
-- + score + fix. So feedback grades the COACHING, not the skill: was_right, and if
-- not, WHAT was off (wrong player / off read / not helpful) + an optional note.
-- This is the real-usage ground-truth stream for improving the analyzer (rubric,
-- prompt, subject detection) without hand-labeling. One row per analysis; the
-- player can change their mind, so writes upsert on analysis_id. Owner-only, same
-- RLS posture as share_links (D-049); no anon surface.

create table public.analysis_feedback (
  analysis_id uuid primary key references public.analyses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  was_right boolean not null,
  -- when not right: any of 'wrong_player','off_read','not_helpful'
  reasons text[] not null default '{}',
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index analysis_feedback_user on public.analysis_feedback (user_id, created_at);

alter table public.analysis_feedback enable row level security;

-- The owner may read/write only their own feedback, and only on an analysis they
-- own (the exists() check mirrors share_links so a forged analysis_id is rejected
-- at the RLS boundary, not just the app layer).
create policy "own analysis feedback" on public.analysis_feedback
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.analyses as a
      where a.id = analysis_id
        and a.user_id = (select auth.uid())
    )
  );

-- 012's default-deny leaves new tables ungranted; open exactly the owner surface.
-- No anon grants: this table is never read through an anonymous path.
grant select, insert, update on table public.analysis_feedback to authenticated;
