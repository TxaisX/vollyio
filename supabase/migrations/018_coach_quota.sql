-- D-047: coach chat abuse limits, shipped while the surface is flagged off.
-- The hourly-only cap (60/hr) allowed 1,440 model calls a day from one
-- account with no billing gate behind it. Ahead of re-enabling the feature,
-- the hourly cap drops to 20 and a rolling 24-hour scope caps a day at 30
-- messages. Inert while /api/coach returns 404; nothing else consumes these
-- scopes.

alter table private.api_rate_limits
  drop constraint api_rate_limits_scope_check;
alter table private.api_rate_limits
  add constraint api_rate_limits_scope_check
  check (scope in ('analyze', 'coach', 'coach_daily', 'account_delete'));

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
    when 'coach_daily' then v_window := interval '24 hours';
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
