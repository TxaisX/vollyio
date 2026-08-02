-- 044: the signup grant rises to 5 (D-080).
--
-- The first day of real launch feedback was unanimous: 3 was not enough room
-- to evaluate the product. 5 buys two full rating progressions on one skill
-- plus a spare, and costs $1.17 per fully-active signup at the measured
-- $0.234/analysis, which keeps D-076's funnel math inside the freemium band.
--
-- This file restates the WHOLE allowance shape from 040 with only the grant
-- number changed, because lib/plans.test.ts resolves the NEWEST migration
-- defining plan_monthly_allowance and asserts every pin against that one
-- file; 040's own comment warns that a partial restatement strands the pins
-- on a superseded definition, and the first draft of this migration proved
-- it right. Production received the one-function version first (identical
-- end state); a fresh environment replaying this file lands in the same
-- place.

-- ---------------------------------------------------------------------------
-- The recurring rate. Was 3 for free.
-- ---------------------------------------------------------------------------
create or replace function public.plan_monthly_allowance(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'pro' then 18
    else 1
  end;
$$;

-- ---------------------------------------------------------------------------
-- The one-time grant. Separate function rather than a constant inside the two
-- callers, so there is exactly one place the number lives and `lib/plans.ts`
-- has a single thing to pin against.
-- ---------------------------------------------------------------------------
create or replace function public.signup_grant()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 5;
$$;

comment on function public.signup_grant() is
  'Completed analyses a new account may run before the monthly rate applies. Spent against lifetime rows in public.analyses, never stored.';

-- ---------------------------------------------------------------------------
-- The window is unchanged: UTC calendar month, or the anchored subscription
-- period once a renewal date exists (migration 035). Restated here because
-- lib/plans.test.ts reads the NEWEST migration defining plan_monthly_allowance
-- and asserts the whole allowance shape against that one file, so a partial
-- restatement would leave the pins asserting against a superseded definition.
-- ---------------------------------------------------------------------------
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
      else w.period_end - interval '1 month'
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
      ) as period_end
  ) w;
$$;

-- ---------------------------------------------------------------------------
-- What the player is shown before they film.
--
-- `allowance` is the ceiling for THIS window, not the plan constant, because
-- with a grant in play those are different numbers and the counter has to name
-- the one actually in force. The least() clause holds it at the grant for a
-- player whose used count exceeds it, which happens after a mid-window
-- downgrade (docs/billing.md section 7): reporting `used` as the ceiling there
-- would render "all 11 of your Free analyses".
-- ---------------------------------------------------------------------------
create or replace function public.analysis_allowance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan text;
  v_starts_at timestamptz;
  v_resets_at timestamptz;
  v_rate int;
  v_grant int := public.signup_grant();
  v_lifetime int;
  v_used int;
  v_grant_left int;
  v_allowance int;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  select plan into v_plan from public.profiles where id = v_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  select starts_at, resets_at into v_starts_at, v_resets_at
  from private.allowance_window(v_user_id, clock_timestamp());

  v_rate := public.plan_monthly_allowance(v_plan);

  select pg_catalog.count(*) into v_used
  from public.analyses
  where user_id = v_user_id and created_at >= v_starts_at;

  -- Lifetime, deliberately unwindowed. This is the only query in the allowance
  -- path without a date bound, and that is what makes the grant one-time.
  select pg_catalog.count(*) into v_lifetime
  from public.analyses
  where user_id = v_user_id;

  v_grant_left := greatest(0, v_grant - v_lifetime);
  v_allowance := greatest(v_rate, least(v_grant_left + v_used, v_grant));

  return jsonb_build_object(
    'plan', v_plan,
    'allowance', v_allowance,
    'used', v_used,
    'remaining', greatest(0, v_allowance - v_used),
    'resets_at', v_resets_at,
    -- Surfaced so the counter can say "3 to start, then 1 a month" while the
    -- grant is live and stop saying it the moment it is spent. A client that
    -- ignores this field still renders a correct count from the three above.
    'grant_remaining', v_grant_left,
    'monthly_rate', v_rate
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The gate. Same signature (lib/security-contract.test.ts pins it), same
-- advisory lock, same five minute reservation, same reasons. The only change is
-- that the refusal now needs BOTH the grant and the window to be empty.
-- ---------------------------------------------------------------------------
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
  v_rate int;
  v_grant int := public.signup_grant();
  v_lifetime int;
  v_used int;
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
    select plan into v_plan
    from public.profiles
    where id = v_user_id;
    if not found then
      raise no_data_found using message = 'profile unavailable';
    end if;

    select starts_at, resets_at into v_starts_at, v_resets_at
    from private.allowance_window(v_user_id, v_now);

    v_rate := public.plan_monthly_allowance(v_plan);

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

-- ---------------------------------------------------------------------------
-- Grants. signup_grant() is a constant with no user data in it, so it is
-- readable by anyone who can already read the plan allowance.
-- ---------------------------------------------------------------------------
grant execute on function public.signup_grant() to anon, authenticated, service_role;
