-- Three functions threw 42883 on every call, and the tests could not see it.
--
-- `GREATEST` and `LEAST` are SQL constructs parsed by the grammar, not functions
-- that live in `pg_catalog`. Writing `pg_catalog.greatest(...)` raises
--
--   42883: function pg_catalog.greatest(...) does not exist
--
-- at execution, not at creation, so `create function` succeeded and the damage
-- only appeared when something actually called it. Schema qualification was
-- never needed: the grammar resolves these regardless of `search_path`, which
-- is the whole reason `search_path = ''` was safe to set.
--
-- What was broken, and it is worse than it sounds:
--
--   set_subscription_plan   EVERY payment. The webhook verified the signature,
--                           mapped the event, resolved the player, called this,
--                           and got an exception. A customer could have paid and
--                           never been upgraded. This is the one that matters.
--   analysis_allowance      The counter the entire funnel reads: the dashboard
--                           line, the analyze page warning, the plan card.
--                           `readAllowance` catches and returns null, so the
--                           counter silently disappeared instead of erroring.
--   refund_api_quota        Every capacity refund. `refundApiQuota` returns
--                           false on error, so a player who hit a provider
--                           outage quietly lost the hourly slot they were owed.
--
-- Why nothing caught it: `lib/plans.test.ts` and `lib/security-contract.test.ts`
-- assert the SQL TEXT contains the right patterns. Text pins catch drift, they
-- do not catch a function that parses and then throws. `supabase/audit/
-- function-smoke.sql` now executes each one inside a rolled-back transaction,
-- which is the check that would have failed on the day this shipped.
--
-- Applied to production in two parts (fix_plan_writer_greatest, then
-- qualified_greatest_fix). This file is the whole statement; every definition
-- here is `create or replace` and safe to re-run.

create or replace function public.set_subscription_plan(
  p_user_id uuid,
  p_plan text,
  p_renews_at timestamptz,
  p_subscription_id text,
  p_customer_id text,
  p_event_at timestamptz default null
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
  from public.profiles
  where id = p_user_id;
  if not found then
    raise no_data_found using message = 'profile unavailable';
  end if;

  v_stale := p_event_at is not null
    and v_last is not null
    and p_event_at < v_last;

  update public.profiles set
    plan = case when v_stale then plan else p_plan end,
    plan_renews_at = case when v_stale then plan_renews_at else p_renews_at end,
    stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
    stripe_customer_id = coalesce(p_customer_id, stripe_customer_id),
    last_billing_event_at = greatest(v_last, coalesce(p_event_at, v_last)),
    updated_at = now()
  where id = p_user_id;

  return not v_stale;
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
  from private.allowance_window(clock_timestamp());

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

create or replace function public.refund_api_quota(
  p_scope text,
  p_reservation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_window interval;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  if p_scope <> 'analyze' then
    raise invalid_parameter_value using message = 'unknown quota scope';
  end if;
  v_window := interval '1 hour';

  if not exists (
    select 1 from private.analysis_entitlement_reservations
    where user_id = v_user_id and reservation_id = p_reservation_id
  ) then
    return false;
  end if;

  update private.api_rate_limits
  set request_count = greatest(0, request_count - 1)
  where user_id = v_user_id
    and scope = p_scope
    and window_started_at + v_window > clock_timestamp();

  return found;
end;
$$;

revoke all on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.set_subscription_plan(uuid, text, timestamptz, text, text, timestamptz)
  to service_role;
revoke all on function public.analysis_allowance() from public, anon;
grant execute on function public.analysis_allowance() to authenticated;
revoke all on function public.refund_api_quota(text, uuid) from public, anon;
grant execute on function public.refund_api_quota(text, uuid) to authenticated;
