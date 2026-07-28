-- The hourly quota was escapable by the player it was meant to bound.
--
-- `refund_api_quota` is SECURITY DEFINER, derives its subject from auth.uid(),
-- and migration 018 granted EXECUTE to `authenticated`. PostgREST publishes
-- every such function at /rest/v1/rpc/<name>, so a signed-in player could call
-- it directly with their own access token. When `request_count <= 1` it DELETES
-- the row instead of writing zero, and the next `consume_api_quota` then
-- inserts a fresh row with `window_started_at = now`. Analyze, refund, repeat:
-- the fixed window never advances and the 20 per hour limit never fires.
--
-- What that costs: `enforce_analysis_insert_limit` still caps INSERTs at 20 an
-- hour, but it is a BEFORE INSERT trigger, so it runs AFTER the coaching call
-- has been made and paid for. Requests past the cap spend real money and then
-- return 429 with no row to show for it. One free account could do this in a
-- loop, and the same trick removed the 3 per hour bound on account deletion.
--
-- The fix is to make the refund require something only the server holds. The
-- entitlement reservation id is generated inside
-- `reserve_analysis_entitlement`, returned to the route, and never sent to a
-- client, so presenting it proves the caller is the analyze route mid-request
-- rather than a player with a token. The grant can stay on `authenticated`
-- because the route legitimately calls this as the player, and the secret is
-- the reservation rather than the role.
--
-- The scope list also narrows to 'analyze'. That is the only refund the product
-- performs (a coaching capacity outage, D-043), and a refund path that exists
-- for scopes nothing refunds is surface with no purpose.

drop function if exists public.refund_api_quota(text);

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

  -- The proof. A player holds an access token but never the reservation id, so
  -- this is what separates the route refunding its own consumed slot from a
  -- caller resetting their window at will. A miss returns quietly: an attacker
  -- learns nothing from the difference between a wrong id and a spent one.
  if not exists (
    select 1
    from private.analysis_entitlement_reservations
    where user_id = v_user_id
      and reservation_id = p_reservation_id
  ) then
    return false;
  end if;

  -- Never delete the row. Deleting it is what let the next consume start a new
  -- window; decrementing to zero leaves `window_started_at` in place so the
  -- window still expires exactly when it always would have.
  update private.api_rate_limits
  set request_count = pg_catalog.greatest(0, request_count - 1)
  where user_id = v_user_id
    and scope = p_scope
    and window_started_at + v_window > clock_timestamp();

  return found;
end;
$$;

revoke all on function public.refund_api_quota(text, uuid) from public, anon;
grant execute on function public.refund_api_quota(text, uuid) to authenticated;
