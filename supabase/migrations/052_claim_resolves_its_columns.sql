-- 052: claim_achievements resolves its own column names (D-089 correction).
--
-- 050 shipped the claim with `returns table (key text, xp integer)`, which in
-- plpgsql declares OUT variables named `key` and `xp`. Inside the function,
-- `insert into public.achievements (user_id, key) ... on conflict (user_id,
-- key)` then had two candidates for `key`, the OUT variable and the table
-- column, and Postgres refused the guess: every call failed with `column
-- reference "key" is ambiguous`. The client's fail-soft catch worked exactly
-- as designed, which is why the defect presented as "no badges, no errors"
-- rather than as a broken page, and why only the server log said the truth.
--
-- The return shape is the API (lib/achievements.ts reads row.key), so the
-- names stay. The fix is the documented one: `#variable_conflict use_column`
-- makes SQL statements inside the function resolve an ambiguous name to the
-- COLUMN, which is what every such reference here means. The two plpgsql
-- assignments to the OUT variables are unaffected, because an assignment
-- target is always the variable. Body otherwise identical to 050's.

create or replace function public.claim_achievements()
returns table (key text, xp integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
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
