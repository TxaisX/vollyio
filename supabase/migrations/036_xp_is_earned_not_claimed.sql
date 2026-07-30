-- XP becomes earned instead of claimed, and the daily challenge gets a record
-- of what was actually done (D-071).
--
-- The hole: `grant insert on public.xp_events to authenticated` (012) lets the
-- CLIENT choose both the amount and the reason. While XP was decorative that
-- was vanity integrity, and docs/security.md said so. It stops being vanity the
-- moment the daily loop, levels, streaks and (next) badges hang off it: a
-- number the player can write is not a progression system, it is a text field.
-- The same product currently refuses to claim a trend without four reps and two
-- days of movement (lib/progress-series.ts) while handing out 75 XP for a click.
--
-- Expand/deploy/contract, because neither plain order is safe on its own: new
-- code calling functions that do not exist yet fails, and old code loses its
-- insert privilege the instant a revoke lands. So this migration only ADDS. It
-- is inert for the running app and can be applied at any time. The revoke that
-- actually closes the hole is 037, and that one goes on only AFTER the code
-- calling these functions is live.

-- ---------------------------------------------------------------------------
-- 1. What the player actually did today.
-- ---------------------------------------------------------------------------

-- One row per player per day. The primary key is the idempotency: a double
-- submit, a retried action, or two tabs cannot produce two completions, which
-- is what keeps the XP award below single even though it is a separate insert.
create table if not exists public.challenge_completions (
  user_id uuid not null references auth.users on delete cascade,
  -- 'YYYY-MM-DD' in America/Los_Angeles, the same key lib/progression.ts pins
  -- streaks to. Text rather than date because the whole streak arithmetic is
  -- calendar-key arithmetic; converting here would reintroduce the timezone
  -- the key exists to remove.
  day_key text not null,
  kind text not null,
  skill text not null,
  drill_slug text,
  -- What the player reported. Bounded so a fat finger or a hostile client
  -- cannot store an absurd number that later reads as a real training volume.
  reps integer,
  felt text,
  created_at timestamptz not null default now(),
  primary key (user_id, day_key),
  constraint challenge_completions_kind_check check (kind in ('drill', 'study')),
  constraint challenge_completions_reps_check
    check (reps is null or (reps >= 0 and reps <= 500)),
  constraint challenge_completions_felt_check
    check (felt is null or felt in ('easy', 'right', 'hard')),
  constraint challenge_completions_day_key_check
    check (day_key ~ '^\d{4}-\d{2}-\d{2}$')
);

alter table public.challenge_completions enable row level security;

-- The player reads their own history. Nobody writes through the data API: the
-- only writer is the security-definer function below, so there is deliberately
-- no insert, update or delete policy and no matching grant.
drop policy if exists "own completions readable" on public.challenge_completions;
create policy "own completions readable"
  on public.challenge_completions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.challenge_completions to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The only way XP is created.
-- ---------------------------------------------------------------------------

-- The amount is decided HERE, from the reason, never passed in. That single
-- change is most of the fix: a client that can name a reason but not a price
-- cannot mint XP, it can only ask whether something it already did is worth
-- any.
--
-- Every branch then verifies the underlying work exists and belongs to the
-- caller, because a bare reason string is a claim and not evidence. Without
-- this, `award_xp('goal:' || gen_random_uuid())` in a loop is unlimited XP.
create or replace function public.award_xp(p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_amount integer;
  v_id uuid;
  v_ok boolean := false;
begin
  if v_user is null or p_reason is null then
    return 0;
  end if;

  -- Reason -> price, and reason -> what must be true for it to be earned.
  if p_reason ~ '^challenge:\d{4}-\d{2}-\d{2}$' then
    v_amount := 75;
    select true into v_ok
    from public.challenge_completions c
    where c.user_id = v_user
      and c.day_key = pg_catalog.substring(p_reason, 11);

  -- Shape-checked against a real uuid pattern, not just a length, because the
  -- ::uuid cast below RAISES on a malformed value and a 500 here would fail the
  -- action that legitimately earned the XP.
  elsif p_reason ~* '^goal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_amount := 150;
    v_id := pg_catalog.substring(p_reason, 6)::uuid;
    select true into v_ok
    from public.goals g
    where g.id = v_id and g.user_id = v_user and g.status = 'done';

  elsif p_reason ~* '^analysis:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_amount := 50;
    v_id := pg_catalog.substring(p_reason, 10)::uuid;
    select true into v_ok
    from public.analyses a
    where a.id = v_id and a.user_id = v_user;

  else
    -- An unrecognised reason is worth nothing. Deliberately not an exception:
    -- a future reason shipped ahead of its migration should award zero and be
    -- visible in the logs, not 500 the action that earned it.
    return 0;
  end if;

  if not coalesce(v_ok, false) then
    return 0;
  end if;

  -- Second award for the same reason is a no-op, so a retry is safe and a
  -- replayed request cannot double-pay. Returns 0 on the repeat, which is what
  -- the caller shows as "already counted".
  if exists (
    select 1 from public.xp_events e
    where e.user_id = v_user and e.reason = p_reason
  ) then
    return 0;
  end if;

  insert into public.xp_events (user_id, amount, reason)
  values (v_user, v_amount, p_reason);

  return v_amount;
end;
$$;

revoke all on function public.award_xp(text) from public;
grant execute on function public.award_xp(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recording the day's work, which is what makes the XP earnable.
-- ---------------------------------------------------------------------------

-- Records the completion and awards in one call, so the two can never
-- disagree: there is no window in which XP exists for a day with no completion
-- behind it, or a completion that silently paid nothing.
--
-- `p_day_key` is checked against the server's own clock rather than trusted.
-- Without that, a client could post 365 day keys and manufacture a year-long
-- streak in a single afternoon, the streak walk in lib/progression.ts only
-- looks at which calendar days have events, so a backfilled key is
-- indistinguishable from a day actually trained. Today or yesterday only:
-- yesterday because a player finishing a drill at 00:05 should still be able
-- to log the session they just did.
create or replace function public.complete_daily_challenge(
  p_day_key text,
  p_kind text,
  p_skill text,
  p_drill_slug text,
  p_reps integer,
  p_felt text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_today text := pg_catalog.to_char(
    pg_catalog.timezone('America/Los_Angeles', pg_catalog.now()), 'YYYY-MM-DD'
  );
  v_yesterday text := pg_catalog.to_char(
    pg_catalog.timezone('America/Los_Angeles', pg_catalog.now())
      - pg_catalog.make_interval(days => 1),
    'YYYY-MM-DD'
  );
begin
  if v_user is null then
    return 0;
  end if;

  if p_day_key is distinct from v_today and p_day_key is distinct from v_yesterday then
    return 0;
  end if;

  -- The table's own constraints are the validation for kind, reps and felt;
  -- restating them here would be two places to keep in step. Anything the
  -- constraints reject raises, and the action surfaces it as a failed save.
  insert into public.challenge_completions
    (user_id, day_key, kind, skill, drill_slug, reps, felt)
  values (v_user, p_day_key, p_kind, p_skill, p_drill_slug, p_reps, p_felt)
  on conflict (user_id, day_key) do nothing;

  return public.award_xp('challenge:' || p_day_key);
end;
$$;

revoke all on function public.complete_daily_challenge(text, text, text, text, integer, text) from public;
grant execute on function public.complete_daily_challenge(text, text, text, text, integer, text)
  to authenticated;
