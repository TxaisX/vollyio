-- Monthly analysis allowance (docs/billing.md).
--
-- Replaces the lifetime-one free check from migration 011 with a per-plan
-- monthly allowance: free 3, pro 18, resetting on the UTC calendar month.
-- The window is the calendar month rather than the subscription anniversary so
-- "how many do I have left" never depends on the payment provider being
-- reachable, and so it agrees with analyze_usage_month() (migration 021).
--
-- The count reads rows in public.analyses, and a row is only inserted after the
-- coaching call returned and parsed. A clip that fails, times out, or hits a
-- capacity outage therefore costs the player nothing and needs no refund path.
-- Count ROWS, never attempts or reservations, or that property is lost.
--
-- The advisory lock and the five-minute reservation from 011 are unchanged:
-- they are what makes two parallel requests unable to both pass the check.

create or replace function public.plan_monthly_allowance(p_plan text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'pro' then 18
    else 3
  end;
$$;

-- Start of the current UTC calendar month, and the instant the allowance
-- resets. Both derived, never passed in, so a client cannot widen its window.
create or replace function private.allowance_window(p_now timestamptz)
returns table (starts_at timestamptz, resets_at timestamptz)
language sql
immutable
set search_path = ''
as $$
  select
    (pg_catalog.date_trunc('month', p_now at time zone 'utc')) at time zone 'utc',
    (pg_catalog.date_trunc('month', p_now at time zone 'utc')
      + interval '1 month') at time zone 'utc';
$$;

create or replace function public.reserve_analysis_entitlement(
  p_enforce_free boolean
)
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
  v_allowance int;
  v_used int;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if p_enforce_free then
    select plan into v_plan
    from public.profiles
    where id = v_user_id;
    if not found then
      raise no_data_found using message = 'profile unavailable';
    end if;

    select starts_at, resets_at into v_starts_at, v_resets_at
    from private.allowance_window(v_now);

    v_allowance := public.plan_monthly_allowance(v_plan);

    select pg_catalog.count(*) into v_used
    from public.analyses
    where user_id = v_user_id
      and created_at >= v_starts_at;

    if v_used >= v_allowance then
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

-- The read the UI needs so a player learns they are out BEFORE filming,
-- uploading and marking, instead of at the 402. Own row only: it keys on
-- auth.uid() and takes no user argument, so there is nothing to tamper with.
create or replace function public.analysis_allowance()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan text;
  v_starts_at timestamptz;
  v_resets_at timestamptz;
  v_allowance int;
  v_used int;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  select plan into v_plan
  from public.profiles
  where id = v_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  select starts_at, resets_at into v_starts_at, v_resets_at
  from private.allowance_window(clock_timestamp());

  v_allowance := public.plan_monthly_allowance(v_plan);

  select pg_catalog.count(*) into v_used
  from public.analyses
  where user_id = v_user_id
    and created_at >= v_starts_at;

  return jsonb_build_object(
    'plan', v_plan,
    'allowance', v_allowance,
    'used', v_used,
    'remaining', pg_catalog.greatest(0, v_allowance - v_used),
    'resets_at', v_resets_at
  );
end;
$$;

revoke all on function public.plan_monthly_allowance(text) from public, anon;
grant execute on function public.plan_monthly_allowance(text) to authenticated;
revoke all on function private.allowance_window(timestamptz)
  from public, anon, authenticated;
revoke all on function public.reserve_analysis_entitlement(boolean)
  from public, anon;
grant execute on function public.reserve_analysis_entitlement(boolean)
  to authenticated;
revoke all on function public.analysis_allowance() from public, anon;
grant execute on function public.analysis_allowance() to authenticated;
