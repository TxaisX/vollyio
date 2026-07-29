-- 035 - The allowance resets on the day they bought, not on the 1st
--
-- `private.allowance_window` took only a timestamp, so it returned the same
-- UTC calendar month to everybody. That made the reset date a property of the
-- calendar rather than of the subscription, with two consequences.
--
-- It was unfair in the player's favour near month end and in ours the rest of
-- the time: someone who subscribed on the 28th got their full Pro allowance for
-- three days and a brand new one on the 1st, while someone who subscribed on
-- the 2nd waited the whole month for theirs. The person who paid the same
-- amount on the 2nd got a twelfth of the analyses per dollar that the person on
-- the 28th did, purely from where the calendar happened to fall.
--
-- It also made the plan's own dates disagree. The charge renews on the
-- anniversary of the purchase, and `profiles.plan_renews_at` already holds that
-- instant, straight from the payment provider. The allowance renewing on a
-- different day than the charge means "your month" meant two different things
-- on the same settings page.
--
-- So the window is now per user and anchored to the period the player actually
-- paid for: [plan_renews_at - 1 month, plan_renews_at].
--
-- The calendar month stays as the fallback, and it is the fallback for a real
-- population, not a theoretical one: free players never bought anything and so
-- have no anchor, a lapsed subscription leaves a `plan_renews_at` in the past,
-- and a malformed provider payload can leave one absurdly far in the future.
-- Each of those falls back to the exact expression this function used before,
-- so a free player's behaviour is byte for byte what it was.
--
-- The two guards on the anchor are both load-bearing. `plan_renews_at > p_now`
-- rejects a lapsed period, and `plan_renews_at - interval '1 month' <= p_now`
-- rejects one so far out that the window would start in the future, which would
-- otherwise count zero used forever and hand out unlimited analyses. Neither is
-- hypothetical: `lib/billing-events.ts` already range-checks the provider's
-- period end for exactly this class of payload.
--
-- Note for anyone editing this file: GREATEST and LEAST are grammar, not
-- catalog functions, so they must never be written as `pg_catalog.greatest`
-- under `search_path = ''`. That mistake shipped once and broke every payment
-- (see 032). This migration avoids them entirely.

-- The new shape. `stable`, not `immutable`, because it now reads a table.
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

-- Both callers below are recreated only to pass the user through. Every other
-- line is the shipped body, so this migration changes which window is used and
-- nothing else about the gate.

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
    from private.allowance_window(v_user_id, v_now);

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

  select plan into v_plan from public.profiles where id = v_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  select starts_at, resets_at into v_starts_at, v_resets_at
  from private.allowance_window(v_user_id, clock_timestamp());

  v_allowance := public.plan_monthly_allowance(v_plan);

  select pg_catalog.count(*) into v_used
  from public.analyses
  where user_id = v_user_id and created_at >= v_starts_at;

  return jsonb_build_object(
    'plan', v_plan,
    'allowance', v_allowance,
    'used', v_used,
    'remaining', greatest(0, v_allowance - v_used),
    'resets_at', v_resets_at
  );
end;
$$;

-- Dropped last, after the only two callers stopped referencing it, so the
-- window can never be missing mid-migration. Nothing outside the database ever
-- called it: it is `private`, and 026 revoked it from every client role.
drop function if exists private.allowance_window(timestamptz);

revoke all on function private.allowance_window(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reserve_analysis_entitlement(boolean) from public, anon;
grant execute on function public.reserve_analysis_entitlement(boolean) to authenticated;
revoke all on function public.analysis_allowance() from public, anon;
grant execute on function public.analysis_allowance() to authenticated;
