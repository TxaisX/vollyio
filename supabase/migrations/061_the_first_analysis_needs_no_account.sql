-- D-118. The analysis is the funnel: a stranger gets one full read before an
-- account is asked for, and the account is asked for on the SECOND rep.
--
-- The anonymous player is a real `auth.users` row (Supabase anonymous sign-in),
-- so `auth.uid()` resolves, every policy in this schema holds unchanged, and
-- `handle_new_user` gives them a `profiles` row exactly as it does for anyone
-- else: `display_name` is nullable, there is no email column, and `plan`
-- defaults to 'free'. Nothing below has to special-case identity. Only the
-- COUNT is special.
--
-- THE CAP IS ENFORCED HERE AND NOT IN THE ROUTE. `reserve_analysis_entitlement`
-- is granted to `authenticated`, and an anonymous user IS `authenticated` as
-- far as Postgres is concerned, so a limit that lives only in TypeScript is a
-- limit that a direct data-API call walks past. This is the only place that
-- cannot be bypassed by anyone holding the session the app just handed them.
--
-- IT IS ALSO NOT CONDITIONAL ON p_enforce_free. Every other wall in this
-- function sits inside that branch, because billing enforcement can be off in
-- an environment and the daily rate is a commercial limit rather than a safety
-- one. The anonymous cap is the opposite: with enforcement off, an unguarded
-- anonymous lane is an unauthenticated vision-model endpoint pointed at one
-- prepaid balance. It fails closed instead.
--
-- Deploy order, and it only goes one way: the APPLICATION ships before this
-- migration. `lib/entitlements.ts` returns `{ ok: false }` for a reason it does
-- not recognise, and the route turns that into a 503. A database that starts
-- answering 'anonymous_used' to code that predates the reason would 503 the
-- exact player this decision exists to convert.

create or replace function public.reserve_analysis_entitlement(p_enforce_free boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_anonymous boolean := coalesce(
    ((select auth.jwt()) ->> 'is_anonymous')::boolean,
    false
  );
  v_plan text;
  v_now timestamptz := clock_timestamp();
  v_reservation_id uuid := gen_random_uuid();
  v_reserved_at timestamptz;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  -- ONE, lifetime, and deliberately not one per day. A recurring anonymous
  -- allowance teaches a player that they never need an account, which is the
  -- opposite of what this funnel is for. Counting rows in `analyses` keeps a
  -- failed clip free here for the same reason it does below (D-064): a read
  -- that never produced a row never spent the run, so a stranger whose first
  -- upload timed out still gets their read.
  --
  -- There is no `resets_at`, because nothing resets. `allowanceDetail` in
  -- lib/entitlements.ts requires a string there and returns null without one,
  -- which is the honest outcome: the refusal names the account, not a clock.
  if v_is_anonymous then
    select pg_catalog.count(*) into v_lifetime
    from public.analyses
    where user_id = v_user_id;

    if v_lifetime >= 1 then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'anonymous_used',
        'reservation_id', null,
        'plan', 'free',
        'allowance', 1,
        'used', v_lifetime,
        'resets_at', null
      );
    end if;
  end if;

  if p_enforce_free then
    select plan, coalesce(analysis_grant, public.signup_grant())
      into v_plan, v_grant
    from public.profiles
    where id = v_user_id;
    if not found then
      raise no_data_found using message = 'profile unavailable';
    end if;

    select starts_at, resets_at into v_starts_at, v_resets_at
    from private.allowance_window(v_user_id, v_now);

    v_rate := public.plan_monthly_allowance(v_plan);
    v_day_rate := public.plan_daily_allowance(v_plan);

    select pg_catalog.count(*) into v_used
    from public.analyses
    where user_id = v_user_id
      and created_at >= v_starts_at;

    select pg_catalog.count(*) into v_lifetime
    from public.analyses
    where user_id = v_user_id;

    v_grant_left := greatest(0, v_grant - v_lifetime);
    v_allowance := greatest(v_rate, least(v_grant_left + v_used, v_grant));

    -- Room in the grant OR room in the window. Counting rows in `analyses` is
    -- what keeps a failed clip free (D-064): a timeout writes no row, so it
    -- spends neither.
    if v_grant_left <= 0 and v_used >= v_rate then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'month_exhausted',
        'reservation_id', null,
        'plan', v_plan,
        'allowance', v_allowance,
        'used', v_used,
        'resets_at', v_resets_at
      );
    end if;

    -- The daily wall, checked AFTER the monthly one so an exhausted month is
    -- still reported as a month rather than as a day that will never refill
    -- into anything. The grant deliberately does NOT bypass it: the grant is
    -- three, the smallest daily rate is three, so a new account still meets the
    -- product's real rhythm instead of burning the trial in one sitting.
    v_day_start := (pg_catalog.date_trunc('day', v_now at time zone 'utc')) at time zone 'utc';

    select pg_catalog.count(*) into v_used_today
    from public.analyses
    where user_id = v_user_id
      and created_at >= v_day_start;

    if v_used_today >= v_day_rate then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'day_exhausted',
        'reservation_id', null,
        'plan', v_plan,
        'allowance', v_day_rate,
        'used', v_used_today,
        'resets_at', v_day_start + interval '1 day'
      );
    end if;
  end if;

  select reserved_at into v_reserved_at
  from private.analysis_entitlement_reservations
  where user_id = v_user_id;
  if v_reserved_at >= v_now - interval '5 minutes' then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'in_progress',
      'reservation_id', null
    );
  end if;

  insert into private.analysis_entitlement_reservations (
    user_id,
    reservation_id,
    analysis_id,
    reserved_at
  ) values (
    v_user_id,
    v_reservation_id,
    null,
    v_now
  )
  on conflict (user_id) do update set
    reservation_id = excluded.reservation_id,
    analysis_id = null,
    reserved_at = excluded.reserved_at;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'reservation_id', v_reservation_id
  );
end;
$$;
