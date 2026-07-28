-- The refund must be unreachable by the player, and zero must be a legal count.
--
-- Migration 030 tried to make the refund safe by demanding an entitlement
-- reservation id, on the stated grounds that only the server ever holds one.
-- That was wrong. `reserve_analysis_entitlement` is granted to `authenticated`,
-- because the analyze route calls it as the player, and it RETURNS the
-- reservation id in its jsonb. A player can call it through the data API and
-- get a valid id, so the secret was never a secret and the quota escape 030
-- claimed to close stayed open the whole time.
--
-- The service role is the authorization now. The route holds that key inside
-- the server and a player never can, so there is nothing to guess and nothing
-- to present. This is the same shape as the plan writer and the telemetry
-- writer, and it is the shape to reach for whenever "only the server may do
-- this" is the requirement.
--
-- Second bug, also introduced by 030: `greatest(0, request_count - 1)` writes 0,
-- and migration 011 declares `check (request_count > 0)`. At a count of 1 the
-- refund raised 23514, `refundApiQuota` swallowed it and returned false, and
-- the route still told the player their clip "wasn't counted against your
-- limit" when it had been. Migration 018 avoided the constraint by DELETING the
-- row, which is precisely what let the next consume start a brand new window.
-- Zero is the honest value: the row means "this window has started", nothing
-- has been spent in it, and the window still expires exactly when it would
-- have.

alter table private.api_rate_limits
  drop constraint if exists api_rate_limits_request_count_check;
alter table private.api_rate_limits
  add constraint api_rate_limits_request_count_check check (request_count >= 0);

drop function if exists public.refund_api_quota(text, uuid);

create or replace function public.refund_api_quota(
  p_user_id uuid,
  p_scope text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window interval;
begin
  if p_user_id is null then
    raise invalid_parameter_value using message = 'user is required';
  end if;

  if p_scope <> 'analyze' then
    raise invalid_parameter_value using message = 'unknown quota scope';
  end if;
  v_window := interval '1 hour';

  update private.api_rate_limits
  set request_count = greatest(0, request_count - 1)
  where user_id = p_user_id
    and scope = p_scope
    and window_started_at + v_window > clock_timestamp();

  return found;
end;
$$;

revoke all on function public.refund_api_quota(uuid, text)
  from public, anon, authenticated;
grant execute on function public.refund_api_quota(uuid, text) to service_role;
