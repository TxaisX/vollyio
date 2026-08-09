-- D-110 follow-up: the counter was still reporting the MONTH.
--
-- 057 made the day the wall that binds and left the month as a 30x backstop.
-- analysis_allowance() never learned that, so a Pro player who could run 18
-- today was shown "528 of 540 left this month" - true, unreachable, and not the
-- number they were about to act on.
--
-- The monthly fields stay in the payload. They are what the backstop refusal
-- reports, and a client older than this migration keeps rendering exactly what
-- it rendered before rather than losing its counter mid-deploy: lib/allowance.ts
-- falls back to the month whenever the four daily fields are absent.

create or replace function public.analysis_allowance()
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan text;
  v_starts_at timestamptz;
  v_resets_at timestamptz;
  v_day_start timestamptz;
  v_rate int;
  v_day_rate int;
  v_grant int;
  v_lifetime int;
  v_used int;
  v_used_today int;
  v_grant_left int;
  v_allowance int;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  select plan, coalesce(analysis_grant, public.signup_grant())
    into v_plan, v_grant
  from public.profiles where id = v_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  select starts_at, resets_at into v_starts_at, v_resets_at
  from private.allowance_window(v_user_id, clock_timestamp());

  v_rate := public.plan_monthly_allowance(v_plan);
  v_day_rate := public.plan_daily_allowance(v_plan);

  select pg_catalog.count(*) into v_used
  from public.analyses
  where user_id = v_user_id and created_at >= v_starts_at;

  -- Lifetime, deliberately unwindowed. This is the only query in the allowance
  -- path without a date bound, and that is what makes the grant one-time.
  select pg_catalog.count(*) into v_lifetime
  from public.analyses
  where user_id = v_user_id;

  -- The day, counted the same way the reservation counts it in 057: rows in
  -- `analyses` since UTC midnight, never attempts, so a failed clip is absent
  -- from this number for the same reason it is free (D-064).
  v_day_start := (pg_catalog.date_trunc('day', clock_timestamp() at time zone 'utc')) at time zone 'utc';

  select pg_catalog.count(*) into v_used_today
  from public.analyses
  where user_id = v_user_id and created_at >= v_day_start;

  v_grant_left := greatest(0, v_grant - v_lifetime);
  v_allowance := greatest(v_rate, least(v_grant_left + v_used, v_grant));

  return jsonb_build_object(
    'plan', v_plan,
    'allowance', v_allowance,
    'used', v_used,
    'remaining', greatest(0, v_allowance - v_used),
    'resets_at', v_resets_at,
    'grant_remaining', v_grant_left,
    'monthly_rate', v_rate,
    'grant', v_grant,
    'lifetime_used', v_lifetime,
    -- The wall that actually binds, and the instant it lifts.
    'daily_allowance', v_day_rate,
    'used_today', v_used_today,
    'remaining_today', greatest(0, v_day_rate - v_used_today),
    'day_resets_at', v_day_start + interval '1 day'
  );
end;
$$;
