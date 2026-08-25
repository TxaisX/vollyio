-- The one dated target a player is training toward (D-127).
--
-- Separate from `goals` on purpose, and the difference is not cosmetic. A goal
-- is a NUMBER to reach on one skill and there may be six of them at once; a
-- target is a DATE the whole season points at and there is exactly one. Folding
-- the date into goals would have meant a nullable "is this the real one" flag
-- and a dashboard that had to guess which of six deadlines framed the page.
--
-- Nothing here is a prediction. The table stores a name and a date; the weeks
-- remaining and the phase those weeks fall in are derived at render time by
-- lib/training-target.ts, which is pure and holds the rule that this product
-- does not forecast tournament performance.

create table if not exists public.training_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null,
  -- The event itself, as a calendar date with no time and no zone. Same
  -- reasoning as goals.deadline: a tournament happens on a day, and storing an
  -- instant would move that day for anyone whose browser is not in Pacific.
  event_date date not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  -- Bounded here as well as in the server action, because the action is a
  -- courtesy to the player and this is the guard. The Data API is directly
  -- callable, so an 80-character limit that lives only in zod is not a limit.
  constraint training_targets_title_length
    check (char_length(btrim(title)) between 1 and 80)
);

alter table public.training_targets enable row level security;

drop policy if exists "own training targets" on public.training_targets;
create policy "own training targets"
  on public.training_targets
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ONE ACTIVE TARGET PER ACCOUNT, held by the database rather than by the UI.
--
-- The commitment device only works because there is a single horizon, and the
-- server action archives the old row before inserting the new one. Two tabs
-- doing that at once would otherwise leave an account with two live targets and
-- a band that renders an arbitrary one of them. A partial unique index makes
-- that race a loud failure the action can report instead of a silent split.
create unique index if not exists training_targets_one_active
  on public.training_targets (user_id)
  where status = 'active';

create index if not exists training_targets_user_created
  on public.training_targets (user_id, created_at desc);

-- Column-scoped, so `id`, `user_id` on update, and `created_at` are outside the
-- grant by construction rather than by anyone remembering to exclude them.
-- Every column a player may write is one they own outright: this table gates no
-- authorization, billing, or scoring decision, the same posture as `goals`.
grant select on table public.training_targets to authenticated;
grant insert (user_id, title, event_date) on table public.training_targets to authenticated;
grant update (title, event_date, status) on table public.training_targets to authenticated;
