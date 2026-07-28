-- Two guards the billing build surfaced.
--
-- 1. A quota scope for the payment routes. AGENTS.md requires an atomic quota
--    before any paid or high-amplification call, and /api/stripe/checkout and
--    /portal were the only mutating cookie-authenticated routes without one.
--    They are cheap per call but they mint real objects at the provider, so an
--    unbounded loop is both a bill and a mess to clean up.
--
-- 2. A ceiling on `analyses.telemetry`. The column is written by the analyze
--    route using the PLAYER'S OWN credentials, so migration 016 had to grant
--    `insert (telemetry)` to authenticated and the server cannot be told apart
--    from a client that posts its own numbers. `analyze_usage_month()` sums
--    that column, `checkAnalyzeBudget` prices the sum, and a tripped budget
--    returns 503 to EVERY player. So a single account able to write arbitrary
--    token counts can take the whole product offline, and now also spam the
--    owner alert. Bounding each field to far above any real analysis and far
--    below anything that could move a monthly total leaves the honest path
--    untouched and removes the denial of service.
--
--    This is a bound, not a fix. The fix is for the server to write telemetry
--    with credentials the player does not hold, which means a service-role
--    write inside the analyze route. Recorded rather than done here because it
--    changes the route's failure modes and belongs in its own change.

alter table private.api_rate_limits
  drop constraint api_rate_limits_scope_check;
alter table private.api_rate_limits
  add constraint api_rate_limits_scope_check
  check (scope in ('analyze', 'coach', 'coach_daily', 'account_delete', 'billing'));

create or replace function public.consume_api_quota(p_scope text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer;
  v_window interval;
  v_now timestamptz := clock_timestamp();
  v_allowed boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication required';
  end if;

  case p_scope
    when 'analyze' then
      v_limit := 20;
      v_window := interval '1 hour';
    when 'coach' then
      v_limit := 20;
      v_window := interval '1 hour';
    when 'coach_daily' then
      v_limit := 30;
      v_window := interval '24 hours';
    when 'account_delete' then
      v_limit := 3;
      v_window := interval '1 hour';
    -- Generous for a human deciding whether to subscribe, tight enough that a
    -- script cannot mint provider objects in a loop.
    when 'billing' then
      v_limit := 10;
      v_window := interval '1 hour';
    else
      raise invalid_parameter_value using message = 'unknown quota scope';
  end case;

  insert into private.api_rate_limits as limits (
    user_id,
    scope,
    window_started_at,
    request_count
  )
  values (v_user_id, p_scope, v_now, 1)
  on conflict (user_id, scope) do update
  set
    window_started_at = case
      when limits.window_started_at + v_window <= v_now then v_now
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at + v_window <= v_now then 1
      else limits.request_count + 1
    end
  returning request_count <= v_limit into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_api_quota(text) from public;
revoke all on function public.consume_api_quota(text) from anon;
grant execute on function public.consume_api_quota(text) to authenticated;

-- Ceilings chosen against measured runs: a real analysis is roughly 40k input
-- and 2k output tokens and finishes inside the route's 120s maxDuration. These
-- sit orders of magnitude above that and still cap what one row can contribute
-- to a monthly spend estimate.
alter table public.analyses drop constraint if exists analyses_telemetry_bounds_check;
alter table public.analyses
  add constraint analyses_telemetry_bounds_check check (
    telemetry is null or (
      coalesce((telemetry->>'input_tokens')::bigint, 0) between 0 and 5000000
      and coalesce((telemetry->>'output_tokens')::bigint, 0) between 0 and 1000000
      and coalesce((telemetry->>'cache_read_input_tokens')::bigint, 0) between 0 and 5000000
      and coalesce((telemetry->>'cache_creation_input_tokens')::bigint, 0) between 0 and 5000000
      and coalesce((telemetry->>'duration_ms')::bigint, 0) between 0 and 600000
    )
  );
