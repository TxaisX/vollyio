-- Analysis resilience (D-043): refund the hourly quota when the coaching
-- service refused before doing any billable work, and record per-analysis
-- telemetry. Additive and safe to apply before the matching route ships: the
-- current route neither calls refund_api_quota nor writes telemetry, so applying
-- this changes no live behavior until feat/pinpoint-motion merges.

-- Give back one unit of the current fixed window. Called only on the pre-charge
-- refusal path (credit or spend-cap outage), where the external service did no
-- billable work. It cannot be used to escape the rate limit: it only decrements
-- inside the active window, never crosses the request_count > 0 check (it deletes
-- a would-be-zero row instead of writing zero), and the window still expires on
-- its own schedule. A refund outside the active window is a no-op.
create or replace function public.refund_api_quota(p_scope text)
returns void
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

  case p_scope
    when 'analyze' then v_window := interval '1 hour';
    when 'coach' then v_window := interval '1 hour';
    when 'account_delete' then v_window := interval '1 hour';
    else raise invalid_parameter_value using message = 'unknown quota scope';
  end case;

  delete from private.api_rate_limits
  where user_id = v_user_id
    and scope = p_scope
    and window_started_at + v_window > clock_timestamp()
    and request_count <= 1;

  update private.api_rate_limits
  set request_count = request_count - 1
  where user_id = v_user_id
    and scope = p_scope
    and window_started_at + v_window > clock_timestamp()
    and request_count > 1;
end;
$$;

revoke all on function public.refund_api_quota(text) from public, anon;
grant execute on function public.refund_api_quota(text) to authenticated;

-- Per-analysis telemetry, set server-side at insert: token counts, wall-clock,
-- model, and effort. Nullable, so older rows and mock runs carry null. Like the
-- result and model columns, it is operational data the row's owner could set via
-- the Data API; it gates no authorization or billing decision and is never read
-- by a client surface.
alter table public.analyses add column if not exists telemetry jsonb;
grant insert (telemetry) on table public.analyses to authenticated;
