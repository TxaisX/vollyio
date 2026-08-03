-- Finishing something now leaves a mark (D-089).
--
-- The product had a ledger (xp_events), levels, streaks and personal bests,
-- and nothing that accumulated into a thing a player could look at. Completing
-- a goal paid the app's largest XP award invisibly and then the goal simply
-- left the screen. Badges are the missing payoff, and they are built on the
-- rule 036 established: XP is earned, not claimed, so a badge is DERIVED from
-- rows that already exist, never accepted from a request.
--
-- Additive only, deliberately. Nothing here alters an existing function,
-- table, grant or policy, so this migration is inert for the running app and
-- can be applied before the code that calls it, in the 036 mold. A deployment
-- where the app ships first degrades to "no badges" because the client treats
-- a missing function or table as an empty result, never as an error.
--
-- What a hostile client can and cannot do here:
--   - It cannot insert a badge: the table has no write grant and no write
--     policy. `claim_achievements` is the only writer.
--   - It cannot choose a price: prices live in this function, keyed by badge.
--   - It cannot earn twice: the (user_id, key) primary key is the idempotency,
--     and the XP insert fires only when that insert was new.
--   - It CAN nudge `goals.completed_at`, because 012 granted goals updates
--     without a column allowlist. That column feeds exactly one cosmetic badge
--     (ahead_of_schedule) and no authorization, billing or scoring decision,
--     which is the same posture as ratings and analysis_feedback: a technical
--     player lying to their own trophy case is a cost we accept on purpose.

-- ---------------------------------------------------------------------------
-- 1. When a goal was finished, for the deadline badge.
-- ---------------------------------------------------------------------------

alter table public.goals
  add column if not exists completed_at timestamptz;

comment on column public.goals.completed_at is
  'Set by the app when the player marks the goal done. Advisory: read by the '
  'ahead_of_schedule badge and nothing else.';

-- ---------------------------------------------------------------------------
-- 2. The trophy case.
-- ---------------------------------------------------------------------------

create table if not exists public.achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  earned_at timestamptz not null default now(),
  -- The primary key IS the idempotency: one badge per player, ever, however
  -- many times the claim runs.
  primary key (user_id, key)
);

alter table public.achievements enable row level security;

-- 023 already fixed default privileges to `revoke all`, but the posture is
-- stated explicitly so this file reads as the complete contract for the table.
revoke all on table public.achievements from public, anon, authenticated;
grant select on table public.achievements to authenticated;

create policy achievements_select_own on public.achievements
  for select to authenticated
  using (user_id = auth.uid());

-- No insert, update or delete policy, and no such grant. Badges are earned in
-- the function below or not at all.

-- ---------------------------------------------------------------------------
-- 3. The one writer.
-- ---------------------------------------------------------------------------

-- Re-derives every criterion from the caller's own rows, inserts anything
-- newly earned, pays the badge's XP through the same ledger everything else
-- pays into, and returns the fresh keys so the client can celebrate them.
-- Takes no arguments: there is nothing to point at another account, the same
-- property analysis_allowance leans on.
create or replace function public.claim_achievements()
returns table (key text, xp integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_analyses integer;
  v_skills integer;
  v_best integer;
  v_goals_done integer;
  v_ahead integer;
  v_challenges integer;
  v_streak integer := 0;
  v_probe date;
  v_badge record;
begin
  if v_user is null then
    raise exception 'claim_achievements requires a signed-in caller';
  end if;

  select count(*), count(distinct a.skill), coalesce(max(a.overall_score), 0)
    into v_analyses, v_skills, v_best
    from public.analyses a
   where a.user_id = v_user;

  select count(*) filter (where g.status = 'done'),
         count(*) filter (where g.status = 'done'
                            and g.deadline is not null
                            and g.completed_at is not null
                            and (g.completed_at at time zone 'America/Los_Angeles')::date
                                  <= g.deadline)
    into v_goals_done, v_ahead
    from public.goals g
   where g.user_id = v_user;

  select count(*)
    into v_challenges
    from public.challenge_completions c
   where c.user_id = v_user;

  -- The streak, by the same rule lib/progression.ts walks: distinct Pacific
  -- calendar days holding any XP event, anchored on today or yesterday. The
  -- 400-step ceiling bounds the loop the same way the client bounds its read.
  v_probe := (now() at time zone 'America/Los_Angeles')::date;
  if not exists (
    select 1 from public.xp_events e
     where e.user_id = v_user
       and (e.created_at at time zone 'America/Los_Angeles')::date = v_probe
  ) then
    v_probe := v_probe - 1;
  end if;
  while v_streak < 400 and exists (
    select 1 from public.xp_events e
     where e.user_id = v_user
       and (e.created_at at time zone 'America/Los_Angeles')::date = v_probe
  ) loop
    v_streak := v_streak + 1;
    v_probe := v_probe - 1;
  end loop;

  -- The catalog. Keys and prices are pinned to lib/achievements.ts by
  -- lib/achievements.test.ts; the earned expressions are the criteria.
  for v_badge in
    select c.badge_key, c.badge_xp
      from (values
        ('first_read',        100, v_analyses >= 1),
        ('ten_reps',          100, v_analyses >= 10),
        ('film_junkie',       200, v_analyses >= 25),
        ('all_six',           150, v_skills >= 6),
        ('eighty_club',       150, v_best >= 80),
        ('ninety_club',       250, v_best >= 90),
        ('finisher',          100, v_goals_done >= 1),
        ('hat_trick',         150, v_goals_done >= 3),
        ('ahead_of_schedule', 100, v_ahead >= 1),
        ('ten_challenges',    100, v_challenges >= 10),
        ('full_week',         150, v_streak >= 7),
        ('habit',             300, v_streak >= 30)
      ) as c (badge_key, badge_xp, earned)
     where c.earned
  loop
    insert into public.achievements (user_id, key)
    values (v_user, v_badge.badge_key)
    on conflict (user_id, key) do nothing;

    -- Only a NEW badge pays and returns. xp_events has no unique constraint on
    -- (user_id, reason), so the achievements primary key above is what makes
    -- the payment single: the insert below fires once per badge per player.
    if not found then
      continue;
    end if;

    insert into public.xp_events (user_id, amount, reason)
    values (v_user, v_badge.badge_xp, 'badge:' || v_badge.badge_key);

    key := v_badge.badge_key;
    xp := v_badge.badge_xp;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_achievements() from public, anon;
grant execute on function public.claim_achievements() to authenticated;
