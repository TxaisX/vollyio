-- 051: the window cannot start in the future (D-090).
--
-- `private.allowance_window` trusts `plan_period_start` exactly as stored.
-- The renewal date beside it gets two guards (`> p_now` proves it is a live
-- period, `- interval '1 month' <= p_now` proves it is the current one), and
-- 035's comment records why: a window anchored in the future would count zero
-- used forever and hand out unlimited analyses. The period START shipped in
-- 049 without the mirror of that guard. Only a provider-signed payload can
-- set the column, so this is hardening against a malformed payload rather
-- than against a player, but the failure mode is the expensive direction: a
-- future start makes `used` read zero for the rest of the period, and every
-- analysis in it is a real paid call.
--
-- One clause changes: the `period_start` subselect now requires
-- `plan_period_start <= p_now`, so a future value falls back to the same
-- `period_end - 1 month` derivation a NULL does, which is the pre-049
-- behavior and always inside the live period. Nothing else moves.
--
-- The application half of the same hardening rides in code: the checkout
-- events now carry preserveBillingDates (lib/billing-events.ts), so the
-- webhook coalesces their null dates from the stored row instead of blanking
-- the anchor a same-burst subscription event just wrote.
--
-- Restated whole for the reason 044 through 049 record: lib/plans.test.ts
-- pins the allowance shape against the newest migration that defines
-- `plan_monthly_allowance`, so a partial restatement would leave those pins
-- asserting against a superseded file. Every statement below is 049's,
-- verbatim, except the one guarded subselect.

alter table public.profiles
  add column if not exists plan_period_start timestamptz;

comment on column public.profiles.plan_period_start is
  'Start of the current billing period exactly as the payment provider reported it. Never computed. NULL falls back to plan_renews_at minus one month.';

drop function if exists public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz);

create or replace function public.set_subscription_plan(
  p_user_id uuid,
  p_plan text,
  p_renews_at timestamptz,
  p_subscription_id text,
  p_customer_id text,
  p_event_at timestamptz default null,
  p_period_start timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
  v_stale boolean;
begin
  if p_plan not in ('free', 'pro') then
    raise check_violation using message = 'unknown plan';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select last_billing_event_at into v_last
  from public.profiles where id = p_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  v_stale := p_event_at is not null and v_last is not null and p_event_at < v_last;

  update public.profiles set
    plan = case when v_stale then plan else p_plan::public.plan_tier end,
    plan_renews_at = case when v_stale then plan_renews_at else p_renews_at end,
    -- Moves with plan_renews_at and never independently: the two describe the
    -- same period and a mismatched pair would be worse than either being stale.
    plan_period_start = case when v_stale then plan_period_start else p_period_start end,
    stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    last_billing_event_at = greatest(v_last, coalesce(p_event_at, v_last)),
    updated_at = now()
  where id = p_user_id;

  return not v_stale;
end;
$$;

revoke all on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz, timestamptz)
  to service_role;

alter table public.profiles
  add column if not exists analysis_grant int;

alter table public.profiles
  drop constraint if exists profiles_analysis_grant_bounds;

alter table public.profiles
  add constraint profiles_analysis_grant_bounds
  check (analysis_grant is null or (analysis_grant >= 0 and analysis_grant <= 500));

comment on column public.profiles.analysis_grant is
  'Per-account override of signup_grant(). NULL means the standard grant. Spent against lifetime rows in public.analyses exactly like the standard grant. Written only by public.set_analysis_grant, service_role only.';

-- ---------------------------------------------------------------------------
-- The owner's lever. Returns the resulting state rather than nothing, so a
-- console call shows what it did instead of requiring a second query.
-- ---------------------------------------------------------------------------
create or replace function public.set_analysis_grant(p_user_id uuid, p_grant int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifetime int;
  v_effective int;
begin
  if p_user_id is null then
    raise invalid_parameter_value using message = 'user id required';
  end if;
  -- Null clears the override and returns the account to the standard grant.
  if p_grant is not null and (p_grant < 0 or p_grant > 500) then
    raise invalid_parameter_value using message = 'grant must be between 0 and 500';
  end if;

  update public.profiles set analysis_grant = p_grant where id = p_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  select pg_catalog.count(*) into v_lifetime
  from public.analyses where user_id = p_user_id;

  v_effective := coalesce(p_grant, public.signup_grant());

  return jsonb_build_object(
    'user_id', p_user_id,
    'grant', p_grant,
    'effective_grant', v_effective,
    'lifetime_analyses', v_lifetime,
    'grant_remaining', greatest(0, v_effective - v_lifetime)
  );
end;
$$;

revoke all on function public.set_analysis_grant(uuid, int) from public, anon, authenticated;
grant execute on function public.set_analysis_grant(uuid, int) to service_role;

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
    when 'pro' then 24
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
  select 6;
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
      -- Prefer the start the PROVIDER reported. Deriving it as period_end minus
      -- one month is wrong by one to three days whenever the anchor is the 29th
      -- to 31st and the period lands in a shorter month, and it is wrong in the
      -- direction that costs the player: a start earlier than the real one
      -- counts the tail of the previous period against the new one. The
      -- coalesce keeps every row written before this migration on the old
      -- derivation until its next billing event lands.
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
          -- The mirror of the renewal's own guards: a start in the future is
          -- a malformed payload, and it falls back to the derivation rather
          -- than opening a window in which nothing has happened yet (D-090).
          and p.plan_period_start <= p_now
      ) as period_start
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
  v_grant int;
  v_lifetime int;
  v_used int;
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
    'monthly_rate', v_rate,
    -- The grant's own two numbers, so the counter can say what was spent of
    -- what was given instead of quoting `allowance`, which is grantLeft + used
    -- and is an artifact rather than a promise (D-084).
    'grant', v_grant,
    'lifetime_used', v_lifetime
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
  v_grant int;
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
