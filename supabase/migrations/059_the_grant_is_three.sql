-- The signup grant drops 6 -> 3, at the owner's direction.
--
-- Restates the whole allowance cluster because lib/plans.test.ts reads the
-- NEWEST migration defining plan_monthly_allowance and asserts the cluster
-- against that single file; changing signup_grant() in isolation would leave
-- the pin reading 057 and pass while production disagreed.
--
-- Worth recording what this number now does, which is nothing. The grant only
-- ever bought room against the MONTHLY wall. D-110 made the day the wall and
-- left the month as an unreachable 30x backstop (90 for free), and the daily
-- rate of 3 applies to a brand new account exactly as it does to an old one. So
-- a new player could run 3 on their first day at a grant of 6 and can run 3 at
-- a grant of 3: the grant is vestigial at either value. lib/plans.ts stopped
-- advertising it in `allowanceSentence` in the same change, because "3 to
-- start, then 3 a day" promises a first day that is identical to every other.
--
-- Left in place rather than removed: it is still the mechanism that would give
-- a new account a real head start if the free daily rate is ever lowered, and
-- ripping out v_grant/v_lifetime touches the advisory-locked reservation for no
-- behavioural gain today.

create or replace function public.plan_monthly_allowance(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'pro' then 540
    else 90
  end;
$$;

-- The wall that actually binds. Mirrors plan_monthly_allowance's shape,
-- including the `else` branch: an unrecognized plan resolves to the free
-- number rather than raising, because failing toward the SMALLER entitlement
-- is the only safe direction for a misconfigured plan string.
create or replace function public.plan_daily_allowance(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'pro' then 18
    else 3
  end;
$$;

create or replace function public.signup_grant()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3;
$$;

create or replace function private.allowance_window(
  p_user_id uuid,
  p_now timestamptz
)
returns table (starts_at timestamptz, resets_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    case
      when w.period_end is null then w.calendar_start
      else coalesce(w.period_start, w.period_end - interval '1 month')
    end,
    case
      when w.period_end is null then w.calendar_start + interval '1 month'
      else w.period_end
    end
  from (
    select
      (pg_catalog.date_trunc('month', p_now at time zone 'utc')) at time zone 'utc'
        as calendar_start,
      (
        select p.plan_renews_at
        from public.profiles p
        where p.id = p_user_id
          and p.plan_renews_at is not null
          and p.plan_renews_at > p_now
          and p.plan_renews_at - interval '1 month' <= p_now
      ) as period_end,
      (
        select p.plan_period_start
        from public.profiles p
        where p.id = p_user_id
          and p.plan_period_start <= p_now
      ) as period_start
  ) w;
$$;

create or replace function public.reserve_analysis_entitlement(p_enforce_free boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
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
    -- six, the smallest daily rate is three, so a new account still spends it
    -- over two days and meets the product's real rhythm instead of burning the
    -- trial in one sitting.
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
